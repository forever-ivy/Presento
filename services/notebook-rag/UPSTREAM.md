# Upstream Notes

## SurfSense

- Upstream project: `Decentralised-AI/SurfSense-Open-Source-Alternative-to-NotebookLM`
- License: Apache-2.0
- Usage in Presento:
  - Retrieval design and compatibility inspiration for hybrid retrieval, RRF fusion, rerank, and hierarchical scope.
  - Presento does **not** adopt SurfSense user/auth/search-space/chat models.
  - Presento keeps its own `Project / KnowledgeChunk / KnowledgeNode / TrainingSession` domain model.
- Local implementation area:
  - `services/notebook-rag/app/retrieval.py`
  - retrieval-related environment variables in `compose.yaml` and `.env.example`

When copying or adapting more upstream code in the future, record:

- upstream commit or tag
- copied file paths
- local modifications
- any additional NOTICE requirements
