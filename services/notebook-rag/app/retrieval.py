from __future__ import annotations

import hashlib
import json
import math
import os
import re
from functools import lru_cache
from typing import Any


EMBEDDING_DIMENSIONS = 384
RRF_K = 60


def prepare_retrieval_chunks(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not chunks:
        return []

    retrieval_texts = [build_retrieval_text(chunk) for chunk in chunks]
    embeddings = embed_texts(retrieval_texts)

    prepared: list[dict[str, Any]] = []
    for chunk, retrieval_text, embedding in zip(chunks, retrieval_texts, embeddings):
        metadata = dict(chunk.get("metadata") or {})
        prepared.append({
            "id": chunk.get("id"),
            "content": str(chunk.get("content") or ""),
            "source": str(chunk.get("source") or metadata.get("fileName") or ""),
            "metadata": metadata,
            "retrieval": {
                "embeddingV2": embedding,
                "sourceId": read_string(metadata, "sourceId"),
                "chunkKind": infer_chunk_kind(metadata, str(chunk.get("source") or "")),
                "page": read_number(metadata, "page"),
                "slide": read_number(metadata, "slide"),
                "sheet": read_string(metadata, "sheet"),
                "codePath": read_string(metadata, "codePath"),
                "lineStart": read_number(metadata, "lineStart"),
                "lineEnd": read_number(metadata, "lineEnd"),
                "retrievalText": retrieval_text,
            },
        })

    return prepared


def retrieve_chunks(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = str(payload["projectId"]).strip()
    query = str(payload["query"]).strip()
    limit = max(1, int(payload.get("limit") or 6))
    filters = {
        "fileId": read_optional_string(payload.get("fileId")),
        "sourceId": read_optional_string(payload.get("sourceId")),
        "slideId": read_optional_string(payload.get("slideId")),
    }

    vector_candidates = fetch_vector_candidates(project_id, query, limit, filters)
    lexical_candidates, lexical_strategy = fetch_lexical_candidates(project_id, query, limit, filters)
    fused_candidates = fuse_candidates(vector_candidates, lexical_candidates)

    if not fused_candidates:
        fallback_chunks = fetch_fallback_chunks(project_id, limit, filters)
        return {
            "chunks": fallback_chunks,
            "mode": "fallback",
            "trace": {
                "query": query,
                "filters": {key: value for key, value in filters.items() if value},
                "vectorCandidateCount": len(vector_candidates),
                "lexicalCandidateCount": len(lexical_candidates),
                "lexicalStrategy": lexical_strategy,
                "reranked": False,
            },
        }

    reranked, reranked_used = rerank_candidates(query, fused_candidates, limit)
    if reranked_used:
        final_candidates = reranked[:limit]
    else:
        final_candidates = sorted(
            fused_candidates,
            key=lambda item: item["rrfScore"],
            reverse=True,
        )[:limit]

    return {
        "chunks": [candidate["chunk"] for candidate in final_candidates],
        "mode": infer_mode(vector_candidates, lexical_candidates),
        "trace": {
            "query": query,
            "filters": {key: value for key, value in filters.items() if value},
            "vectorCandidateCount": len(vector_candidates),
            "lexicalCandidateCount": len(lexical_candidates),
            "lexicalStrategy": lexical_strategy,
            "reranked": reranked_used,
        },
    }


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    try:
        model = get_sentence_transformer_model()
        encoded = model.encode(texts, normalize_embeddings=True)
        return [normalize_vector([float(value) for value in vector]) for vector in encoded]
    except Exception:
        return [hash_embedding(text) for text in texts]


@lru_cache(maxsize=1)
def get_sentence_transformer_model():
    from sentence_transformers import SentenceTransformer

    model_name = os.getenv("NOTEBOOK_RAG_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    return SentenceTransformer(model_name)


def hash_embedding(text: str, dimensions: int = EMBEDDING_DIMENSIONS) -> list[float]:
    vector = [0.0] * dimensions
    tokens = tokenize(text)
    if not tokens:
        return vector

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        bucket = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[bucket] += sign

    return normalize_vector(vector)


def normalize_vector(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return vector
    return [value / magnitude for value in vector]


def build_retrieval_text(chunk: dict[str, Any]) -> str:
    metadata = dict(chunk.get("metadata") or {})
    parts = [
        read_string(metadata, "fileName"),
        read_string(metadata, "artifactTitle"),
        read_string(metadata, "codePath"),
        str(chunk.get("source") or "").strip() or None,
        str(chunk.get("content") or "").strip() or None,
    ]
    return "\n".join(part for part in parts if part)


def infer_chunk_kind(metadata: dict[str, Any], source: str) -> str:
    if read_string(metadata, "chunkKind"):
        return read_string(metadata, "chunkKind") or "document"
    if read_string(metadata, "codePath"):
        return "code"
    if read_string(metadata, "sheet") or read_string(metadata, "cellRange"):
        return "table"
    if read_number(metadata, "slide") is not None or "presentation" in source:
        return "slide"
    if read_number(metadata, "page") is not None:
        return "document"

    kind = read_string(metadata, "kind")
    return kind or "document"


def fetch_vector_candidates(
    project_id: str,
    query: str,
    limit: int,
    filters: dict[str, str | None],
) -> list[dict[str, Any]]:
    query_vector = vector_literal(embed_texts([query])[0])
    sql = f"""
SELECT
  "id", "projectId", "artifactId", "fileId", "content", "source", "metadata", "createdAt",
  "embeddingV2" <=> %s::vector AS distance
FROM "KnowledgeChunk"
WHERE "projectId" = %s
  AND "embeddingV2" IS NOT NULL
  {build_filter_sql(filters)}
ORDER BY "embeddingV2" <=> %s::vector
LIMIT %s;
"""
    params = [query_vector, project_id, *build_filter_params(filters), query_vector, max(limit * 4, 24)]
    rows = fetch_rows(sql, params)
    return [
        {
            "chunk": row_to_chunk(row),
            "vectorRank": index + 1,
        }
        for index, row in enumerate(rows)
    ]


def fetch_lexical_candidates(
    project_id: str,
    query: str,
    limit: int,
    filters: dict[str, str | None],
) -> tuple[list[dict[str, Any]], str]:
    fts_candidates = fetch_fts_candidates(project_id, query, limit, filters)
    if fts_candidates:
        return fts_candidates, "fts"

    scanned_rows = fetch_rows(
        f"""
SELECT
  "id", "projectId", "artifactId", "fileId", "content", "source", "metadata", "createdAt"
FROM "KnowledgeChunk"
WHERE "projectId" = %s
  {build_filter_sql(filters)}
ORDER BY COALESCE("slide", 0), COALESCE("page", 0), COALESCE("lineStart", 0), "createdAt"
LIMIT %s;
""",
        [project_id, *build_filter_params(filters), max(limit * 12, 120)],
    )
    scored = []
    for row in scanned_rows:
        chunk = row_to_chunk(row)
        score = lexical_score(query, build_retrieval_text({
            "content": chunk["content"],
            "source": chunk["source"],
            "metadata": chunk["metadata"],
        }))
        if score <= 0:
            continue
        scored.append({
            "chunk": chunk,
            "lexicalRank": score,
        })

    scored.sort(key=lambda item: item["lexicalRank"], reverse=True)
    for index, item in enumerate(scored):
        item["lexicalRank"] = index + 1
    return scored[: max(limit * 4, 24)], "token-overlap"


def fetch_fts_candidates(
    project_id: str,
    query: str,
    limit: int,
    filters: dict[str, str | None],
) -> list[dict[str, Any]]:
    sql = f"""
SELECT
  "id", "projectId", "artifactId", "fileId", "content", "source", "metadata", "createdAt",
  ts_rank_cd("fts", websearch_to_tsquery('simple', %s)) AS lexical_rank
FROM "KnowledgeChunk"
WHERE "projectId" = %s
  AND "fts" @@ websearch_to_tsquery('simple', %s)
  {build_filter_sql(filters)}
ORDER BY lexical_rank DESC
LIMIT %s;
"""
    try:
        rows = fetch_rows(sql, [query, project_id, query, *build_filter_params(filters), max(limit * 4, 24)])
    except Exception:
        return []
    return [
        {
            "chunk": row_to_chunk(row),
            "lexicalRank": index + 1,
        }
        for index, row in enumerate(rows)
    ]


def fetch_fallback_chunks(
    project_id: str,
    limit: int,
    filters: dict[str, str | None],
) -> list[dict[str, Any]]:
    rows = fetch_rows(
        f"""
SELECT
  "id", "projectId", "artifactId", "fileId", "content", "source", "metadata", "createdAt"
FROM "KnowledgeChunk"
WHERE "projectId" = %s
  {build_filter_sql(filters)}
ORDER BY COALESCE("slide", 0), COALESCE("page", 0), COALESCE("lineStart", 0), "createdAt"
LIMIT %s;
""",
        [project_id, *build_filter_params(filters), limit],
    )
    return [row_to_chunk(row) for row in rows]


def fuse_candidates(
    vector_candidates: list[dict[str, Any]],
    lexical_candidates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    fused: dict[str, dict[str, Any]] = {}

    for index, candidate in enumerate(vector_candidates, start=1):
        chunk = candidate["chunk"]
        entry = fused.setdefault(chunk["id"], {"chunk": chunk, "rrfScore": 0.0})
        entry["rrfScore"] += 1.0 / (RRF_K + index)

    for index, candidate in enumerate(lexical_candidates, start=1):
        chunk = candidate["chunk"]
        entry = fused.setdefault(chunk["id"], {"chunk": chunk, "rrfScore": 0.0})
        entry["rrfScore"] += 1.0 / (RRF_K + index)

    return list(fused.values())


def rerank_candidates(
    query: str,
    candidates: list[dict[str, Any]],
    limit: int,
) -> tuple[list[dict[str, Any]], bool]:
    if len(candidates) <= 1:
        return candidates, False

    try:
        from flashrank import Ranker, RerankRequest

        ranker = get_flashrank_ranker()
        passages = [
            {
                "id": candidate["chunk"]["id"],
                "text": candidate["chunk"]["content"],
                "meta": candidate["chunk"],
            }
            for candidate in candidates[: max(limit * 3, 12)]
        ]
        reranked = ranker.rerank(RerankRequest(query=query, passages=passages))
        order = [item["id"] for item in reranked if item.get("id")]
        ranked_by_id = {candidate["chunk"]["id"]: candidate for candidate in candidates}
        ordered = [ranked_by_id[item_id] for item_id in order if item_id in ranked_by_id]
        if ordered:
            return ordered, True
    except Exception:
        return candidates, False

    return candidates, False


@lru_cache(maxsize=1)
def get_flashrank_ranker():
    from flashrank import Ranker

    model_name = os.getenv("NOTEBOOK_RAG_RERANK_MODEL", "ms-marco-MiniLM-L-12-v2")
    return Ranker(model_name=model_name)


def infer_mode(
    vector_candidates: list[dict[str, Any]],
    lexical_candidates: list[dict[str, Any]],
) -> str:
    if vector_candidates and lexical_candidates:
        return "hybrid"
    if lexical_candidates:
        return "lexical"
    if vector_candidates:
        return "vector"
    return "fallback"


def fetch_rows(sql: str, params: list[Any]) -> list[dict[str, Any]]:
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ModuleNotFoundError as exc:
        raise RuntimeError("psycopg is required for retrieval v2.") from exc

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for retrieval v2.")

    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall()

    return [dict(row) for row in rows]


def row_to_chunk(row: dict[str, Any]) -> dict[str, Any]:
    metadata = row.get("metadata")
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError:
            metadata = {}
    metadata = metadata or {}

    created_at = row.get("createdAt")
    created_at_text = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)
    return {
        "id": str(row.get("id") or ""),
        "projectId": str(row.get("projectId") or ""),
        "artifactId": read_optional_string(row.get("artifactId")),
        "fileId": read_optional_string(row.get("fileId")),
        "content": str(row.get("content") or ""),
        "source": str(row.get("source") or ""),
        "metadata": metadata,
        "createdAt": created_at_text,
    }


def build_filter_sql(filters: dict[str, str | None]) -> str:
    clauses: list[str] = []
    if filters.get("fileId"):
        clauses.append('AND "fileId" = %s')
    if filters.get("sourceId"):
        clauses.append('AND "sourceId" = %s')
    return "\n  " + "\n  ".join(clauses) if clauses else ""


def build_filter_params(filters: dict[str, str | None]) -> list[str]:
    params: list[str] = []
    if filters.get("fileId"):
        params.append(str(filters["fileId"]))
    if filters.get("sourceId"):
        params.append(str(filters["sourceId"]))
    return params


def lexical_score(query: str, text: str) -> float:
    query_tokens = tokenize(query)
    text_tokens = tokenize(text)
    if not query_tokens or not text_tokens:
        return 0.0

    overlap = query_tokens.intersection(text_tokens)
    score = float(len(overlap))
    if text.startswith("#") or text.startswith("[page") or text.startswith("[slide"):
        score += 0.25
    return score


def tokenize(text: str) -> set[str]:
    groups = re.findall(r"[\u4e00-\u9fff]+|[A-Za-z0-9_]+", text.lower())
    tokens: set[str] = set()
    for group in groups:
        if re.fullmatch(r"[\u4e00-\u9fff]+", group):
            tokens.update(group)
            tokens.add(group)
        else:
            tokens.add(group)
    return tokens


def vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{value:.6f}" for value in vector) + "]"


def read_string(metadata: dict[str, Any], key: str) -> str | None:
    value = metadata.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


def read_number(metadata: dict[str, Any], key: str) -> int | None:
    value = metadata.get(key)
    return value if isinstance(value, int) else None


def read_optional_string(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None
