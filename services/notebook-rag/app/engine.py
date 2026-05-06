from typing import Any

from app.llm import generate_grounded_answer, stream_grounded_answer
from app.parsers import (
    chunk_text,
    citation_from_chunk,
    extract_text,
    first_line,
    infer_outline,
    summarize_text,
    title_from_filename,
)
from app.retrieval import prepare_retrieval_chunks, retrieve_chunks
from app.storage import read_payload_bytes


def build_parse_result(payload: dict[str, Any]) -> dict[str, Any]:
    repository_url = payload.get("repositoryUrl")
    if repository_url:
        text, extras = extract_text(
            payload["fileName"],
            payload["fileKind"],
            repository_url=repository_url,
        )
        source_mode = "repository_url"
    else:
        data, source_mode = read_payload_bytes(payload)
        text, extras = extract_text(payload["fileName"], payload["fileKind"], data)
    chunks = extras.get("chunks") or chunk_text(text, payload["fileName"], extras.get("chunkMetadata", {}))
    outline = infer_outline(text)
    return {
        "source": {
            "title": title_from_filename(payload["fileName"]),
            "summary": summarize_text(text, payload["fileName"]),
            "fileKind": payload["fileKind"],
            "metadata": {
                "mimeType": payload.get("mimeType"),
                "repositoryUrl": repository_url,
                "storagePath": payload.get("storagePath"),
                "storageKey": payload.get("storageKey"),
                **extras.get("sourceMetadata", {}),
            },
        },
        "metadata": {
            "retrievalReady": len(chunks) > 0,
            "sourceMode": source_mode,
            "parser": extras.get("chunkMetadata", {}).get("parser"),
        },
        "chunks": chunks,
        "preview": {
            "text": "\n".join(text.splitlines()[:24]),
            "outline": outline,
            "metadata": {
                "sourceMode": source_mode,
            },
        },
        "slides": extras.get("slides", []),
        "tables": extras.get("tables", []),
        "codeTree": extras.get("codeTree", []),
        "citations": [citation_from_chunk(payload["fileName"], chunk) for chunk in chunks[:8]],
    }


def prepare_retrieval_chunks_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    chunks = payload.get("chunks", [])
    if not isinstance(chunks, list):
        raise ValueError("chunks must be a list.")

    return {
        "chunks": prepare_retrieval_chunks(chunks),
    }


def retrieve_chunks_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    project_id = str(payload.get("projectId") or "").strip()
    query = str(payload.get("query") or "").strip()
    if not project_id:
        raise ValueError("projectId is required.")
    if not query:
        raise ValueError("query is required.")

    limit = int(payload.get("limit") or 6)
    return retrieve_chunks({
        "projectId": project_id,
        "query": query,
        "limit": max(1, limit),
        "fileId": payload.get("fileId"),
        "sourceId": payload.get("sourceId"),
        "slideId": payload.get("slideId"),
    })


def explain_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    chunks = payload.get("chunks", [])
    mode = payload.get("mode", "quick")
    question = (payload.get("question") or "").strip()
    top_k = int(payload.get("topK") or (4 if mode == "quick" else 8))
    retrieval_mode = payload.get("retrievalMode") or mode
    ranked_chunks = select_chunks(chunks, question=question, top_k=top_k, mode=mode)
    if not ranked_chunks:
        return insufficient_evidence_response()

    citations = [citation_from_chunk(payload["fileName"], chunk) for chunk in ranked_chunks]
    outline = [first_line(chunk.get("content", "")) for chunk in ranked_chunks if first_line(chunk.get("content", ""))]
    llm_result = generate_grounded_answer(build_llm_prompt(payload, ranked_chunks, outline, citations), mode=mode)

    if llm_result:
        return {
            "summary": llm_result.get("summary") or default_summary(payload["fileName"], outline, question),
            "outline": llm_result.get("outline") or outline,
            "answer": llm_result.get("answer") or deterministic_answer(payload["fileName"], outline, question, mode),
            "citations": citations,
            "grounded": True,
            "insufficientEvidence": False,
            "followUps": llm_result.get("followUps") or default_follow_ups(),
            "quiz": llm_result.get("quiz") or ([] if mode == "quick" else default_quiz()),
            "weaknessCandidates": llm_result.get("weaknessCandidates") or default_weaknesses(),
            "metadata": {
                "engine": "sidecar-llm",
                "retrievalCount": len(ranked_chunks),
                "retrievalMode": retrieval_mode,
                "fallbackUsed": False,
            },
        }

    return {
        "summary": default_summary(payload["fileName"], outline, question),
        "outline": outline,
        "answer": deterministic_answer(payload["fileName"], outline, question, mode),
        "citations": citations,
        "grounded": True,
        "insufficientEvidence": False,
        "followUps": default_follow_ups(),
        "quiz": [] if mode == "quick" else default_quiz(),
        "weaknessCandidates": default_weaknesses(),
        "metadata": {
            "engine": "sidecar-deterministic",
            "retrievalCount": len(ranked_chunks),
            "retrievalMode": retrieval_mode,
            "fallbackUsed": True,
        },
    }


def stream_explain_from_payload(payload: dict[str, Any]):
    chunks = payload.get("chunks", [])
    mode = payload.get("mode", "quick")
    question = (payload.get("question") or "").strip()
    top_k = int(payload.get("topK") or (4 if mode == "quick" else 8))
    retrieval_mode = payload.get("retrievalMode") or mode

    yield {"event": "started", "data": {"mode": mode}}
    ranked_chunks = select_chunks(chunks, question=question, top_k=top_k, mode=mode)
    yield {
        "event": "retrieval",
        "data": {
            "retrievalCount": len(ranked_chunks),
            "retrievalMode": retrieval_mode,
        },
    }

    if not ranked_chunks:
        response = insufficient_evidence_response()
        yield {"event": "completed", "data": response}
        return

    citations = [citation_from_chunk(payload["fileName"], chunk) for chunk in ranked_chunks]
    outline = [first_line(chunk.get("content", "")) for chunk in ranked_chunks if first_line(chunk.get("content", ""))]
    prompt = build_llm_prompt(payload, ranked_chunks, outline, citations)
    streamed_text = []
    llm_stream = stream_grounded_answer(prompt, mode=mode)

    if llm_stream is None:
        response = {
            **deterministic_response(payload["fileName"], outline, citations, question, mode),
            "metadata": {
                "engine": "sidecar-deterministic",
                "retrievalCount": len(ranked_chunks),
                "retrievalMode": retrieval_mode,
                "fallbackUsed": True,
            },
        }
        yield {
            "event": "fallback",
            "data": {
                "engine": "sidecar-deterministic",
                "reason": "llm_unavailable",
            },
        }
        yield from stream_text_answer(response["answer"])
        yield {"event": "citations", "data": {"citations": citations}}
        yield {"event": "completed", "data": response}
        return

    for delta in llm_stream:
        streamed_text.append(delta)
        yield {"event": "delta", "data": {"delta": delta}}

    answer = "".join(streamed_text).strip()
    if not answer:
        llm_result = generate_grounded_answer(prompt, mode=mode)
        answer = (llm_result or {}).get("answer") or deterministic_answer(payload["fileName"], outline, question, mode)
    response = {
        "summary": default_summary(payload["fileName"], outline, question),
        "outline": outline,
        "answer": answer,
        "citations": citations,
        "grounded": True,
        "insufficientEvidence": False,
        "followUps": default_follow_ups(),
        "quiz": [] if mode == "quick" else default_quiz(),
        "weaknessCandidates": default_weaknesses(),
        "metadata": {
            "engine": "sidecar-llm",
            "retrievalCount": len(ranked_chunks),
            "retrievalMode": retrieval_mode,
            "fallbackUsed": False,
        },
    }
    yield {"event": "citations", "data": {"citations": citations}}
    yield {"event": "completed", "data": response}


def select_chunks(
    chunks: list[dict[str, Any]],
    *,
    question: str,
    top_k: int,
    mode: str,
) -> list[dict[str, Any]]:
    if not chunks:
        return []

    if not question:
        return chunks[:top_k]

    ranked = sorted(
        chunks,
        key=lambda chunk: score_chunk(question, chunk.get("content", "")),
        reverse=True,
    )
    best_score = score_chunk(question, ranked[0].get("content", "")) if ranked else 0
    if best_score <= 0:
        return []
    return ranked[:top_k if mode == "mastery" else min(top_k, 4)]


def score_chunk(question: str, content: str) -> float:
    query_tokens = tokenize(question)
    content_tokens = tokenize(content)
    if not query_tokens or not content_tokens:
        return 0

    overlap = query_tokens.intersection(content_tokens)
    score = float(len(overlap))
    if content.startswith("#") or content.startswith("[page") or content.startswith("[slide"):
        score += 0.25
    return score


def tokenize(text: str) -> set[str]:
    import re

    lowered = text.lower()
    groups = re.findall(r"[\u4e00-\u9fff]+|[A-Za-z0-9_]+", lowered)
    tokens: set[str] = set()
    for group in groups:
        if re.fullmatch(r"[\u4e00-\u9fff]+", group):
            tokens.update(group)
            tokens.add(group)
        else:
            tokens.add(group)
    return tokens


def insufficient_evidence_response() -> dict[str, Any]:
    return {
        "summary": "依据不足：当前文件没有可检索片段。",
        "outline": [],
        "answer": "依据不足：我不能在没有文件证据的情况下编造答案。",
        "citations": [],
        "grounded": False,
        "insufficientEvidence": True,
        "followUps": [],
        "quiz": [],
        "weaknessCandidates": [],
        "metadata": {
            "engine": "sidecar-deterministic",
            "retrievalCount": 0,
            "fallbackUsed": True,
        },
    }


def deterministic_answer(file_name: str, outline: list[str], question: str, mode: str) -> str:
    if question and not is_low_signal_question(question):
        return f"围绕“{question}”，可以依据文件这样回答：{'; '.join(outline[:4])}。"

    if question:
        return "\n".join([
            "我在。当前资料里能支撑的答辩点主要是：",
            f"{'; '.join(outline[:4])}。",
            "你可以继续追问它的作用、实现细节，或者让它整理成 30 秒答辩话术。",
        ])

    if mode == "quick":
        summary = default_summary(file_name, outline, question)
        return "\n".join([
            f"一句话：{summary}",
            f"3-5 个要点：{'; '.join(outline[:5])}",
            "高危追问：技术选择依据、个人贡献、结果证据。",
            "30 秒框架：目标 -> 方法 -> 证据 -> 我的贡献。",
        ])

    return "\n".join([
        default_summary(file_name, outline, question),
        "分段讲解：",
        *[f"{index + 1}. {item}" for index, item in enumerate(outline)],
        "自测题：请解释核心目标、关键证据、个人贡献和可能追问。",
    ])


def default_summary(file_name: str, outline: list[str], question: str) -> str:
    if question:
        return f"{file_name} 追问回答"
    return f"{file_name} 的核心重点是：{', '.join(outline[:3])}。"


def default_follow_ups() -> list[str]:
    return ["把它压缩成 30 秒回答", "列出最可能被追问的 3 个点"]


def default_quiz() -> list[str]:
    return ["核心证据是什么？", "你负责了哪一部分？"]


def default_weaknesses() -> list[str]:
    return ["证据引用不熟", "个人贡献边界不清"]


def is_low_signal_question(question: str) -> bool:
    normalized = question.strip().lower()
    return normalized in {"hi", "hello", "hey", "你好", "在吗", "test", "测试"} or len(normalized) <= 2


def deterministic_response(
    file_name: str,
    outline: list[str],
    citations: list[dict[str, Any]],
    question: str,
    mode: str,
) -> dict[str, Any]:
    return {
        "summary": default_summary(file_name, outline, question),
        "outline": outline,
        "answer": deterministic_answer(file_name, outline, question, mode),
        "citations": citations,
        "grounded": True,
        "insufficientEvidence": False,
        "followUps": default_follow_ups(),
        "quiz": [] if mode == "quick" else default_quiz(),
        "weaknessCandidates": default_weaknesses(),
    }


def stream_text_answer(text: str):
    chunk_size = 48
    for index in range(0, len(text), chunk_size):
        yield {"event": "delta", "data": {"delta": text[index:index + chunk_size]}}


def build_llm_prompt(
    payload: dict[str, Any],
    ranked_chunks: list[dict[str, Any]],
    outline: list[str],
    citations: list[dict[str, Any]],
) -> str:
    evidence_lines = []
    for index, chunk in enumerate(ranked_chunks, start=1):
        citation = citations[index - 1]
        evidence_lines.append(
            f"[{index}] citation={citation} content={chunk.get('content', '')}"
        )

    return "\n".join([
        f"file={payload['fileName']}",
        f"mode={payload.get('mode', 'quick')}",
        f"question={payload.get('question') or 'N/A'}",
        f"outline={outline}",
        "evidence:",
        *evidence_lines,
    ])
