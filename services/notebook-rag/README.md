# Notebook RAG Sidecar

FastAPI sidecar for heavyweight file parsing and NotebookLM-style file explanation.

This service is intentionally stateless: it parses request payloads and returns normalized JSON to the Next.js API, which remains responsible for database writes, authorization, and project ownership checks.

Reference projects reviewed for architecture: Open Notebook and SurfSense. This initial sidecar does not copy product code from either project; it implements a small compatible contract using permissive Python parser libraries.

## Endpoints

- `GET /health`
- `POST /parse-file`
- `POST /explain-file`
- `POST /chat-file`

Set `NOTEBOOK_RAG_API_KEY` to require the same `x-api-key` header that the Next.js backend sends.
