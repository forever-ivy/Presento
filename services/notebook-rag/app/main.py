from typing import Any, Literal

import json

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.engine import (
    build_parse_result,
    explain_from_payload,
    prepare_retrieval_chunks_from_payload,
    retrieve_chunks_from_payload,
    stream_explain_from_payload,
)


app = FastAPI(title="Presento Notebook RAG Sidecar", version="0.2.0")


class ParseFileRequest(BaseModel):
    fileId: str
    fileName: str
    fileKind: str
    mimeType: str | None = None
    repositoryUrl: str | None = None
    storagePath: str | None = None
    storageKey: str | None = None
    signedUrl: str | None = None
    contentBase64: str | None = None


class ExplainChunk(BaseModel):
    id: str | None = None
    source: str | None = None
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ExplainFileRequest(BaseModel):
    fileId: str
    fileName: str
    mode: Literal["quick", "mastery"] = "quick"
    chunks: list[ExplainChunk] = Field(default_factory=list)
    retrievalMode: Literal["quick", "mastery", "auto"] = "auto"
    topK: int | None = None
    conversationContext: list[ConversationTurn] = Field(default_factory=list)
    question: str | None = None


class PrepareRetrievalChunksRequest(BaseModel):
    chunks: list[ExplainChunk] = Field(default_factory=list)


class RetrieveChunksRequest(BaseModel):
    projectId: str
    query: str
    limit: int | None = None
    fileId: str | None = None
    sourceId: str | None = None
    slideId: str | None = None


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    import os

    expected = os.getenv("NOTEBOOK_RAG_API_KEY")
    if expected and x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid sidecar API key.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse-file", dependencies=[Depends(require_api_key)])
def parse_file(payload: ParseFileRequest) -> dict[str, Any]:
    return build_parse_result(payload.model_dump())


@app.post("/prepare-retrieval-chunks", dependencies=[Depends(require_api_key)])
def prepare_retrieval_chunks(payload: PrepareRetrievalChunksRequest) -> dict[str, Any]:
    return prepare_retrieval_chunks_from_payload(payload.model_dump())


@app.post("/retrieve-chunks", dependencies=[Depends(require_api_key)])
def retrieve_chunks(payload: RetrieveChunksRequest) -> dict[str, Any]:
    return retrieve_chunks_from_payload(payload.model_dump())


@app.post("/explain-file", dependencies=[Depends(require_api_key)])
def explain_file(payload: ExplainFileRequest) -> dict[str, Any]:
    return explain_from_payload(payload.model_dump())


@app.post("/chat-file", dependencies=[Depends(require_api_key)])
def chat_file(payload: ExplainFileRequest) -> dict[str, Any]:
    if not payload.question:
        raise HTTPException(status_code=400, detail="Missing question.")
    return explain_from_payload(payload.model_dump())


@app.post("/explain-file-stream", dependencies=[Depends(require_api_key)])
def explain_file_stream(payload: ExplainFileRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_as_sse(stream_explain_from_payload(payload.model_dump())),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/chat-file-stream", dependencies=[Depends(require_api_key)])
def chat_file_stream(payload: ExplainFileRequest) -> StreamingResponse:
    if not payload.question:
        raise HTTPException(status_code=400, detail="Missing question.")
    return StreamingResponse(
        stream_as_sse(stream_explain_from_payload(payload.model_dump())),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def stream_as_sse(events: Any):
    try:
        for event in events:
            yield f"event: {event['event']}\n"
            yield f"data: {json.dumps(event.get('data', {}), ensure_ascii=False)}\n\n"
    except Exception as exc:
        yield "event: error\n"
        yield f"data: {json.dumps({'message': str(exc)}, ensure_ascii=False)}\n\n"
    yield "data: [DONE]\n\n"
