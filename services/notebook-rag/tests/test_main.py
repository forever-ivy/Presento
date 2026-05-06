import base64
import io
import unittest
import zipfile
from unittest.mock import patch

from app.engine import (
    build_parse_result,
    explain_from_payload,
    prepare_retrieval_chunks_from_payload,
    retrieve_chunks_from_payload,
    stream_explain_from_payload,
)
from app.llm import select_model_for_mode
from app.parsers import extract_document_with_docling


def build_minimal_pptx(slide_text: str) -> bytes:
    text_nodes = "".join(f"<a:t>{line}</a:t>" for line in slide_text.splitlines())
    slide_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
        f"<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r>{text_nodes}</a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>"
        "</p:sld>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("ppt/slides/slide1.xml", slide_xml)
    return buffer.getvalue()


def build_minimal_docx(document_text: str) -> bytes:
    text_nodes = "".join(f"<w:t>{line}</w:t>" for line in document_text.splitlines())
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r>{text_nodes}</w:r></w:p></w:body>"
        "</w:document>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", document_xml)
    return buffer.getvalue()


class NotebookRagContractTests(unittest.TestCase):
    def test_modes_use_deepseek_v4_flash_and_pro_by_default(self) -> None:
        with patch.dict("os.environ", {"LLM_MODEL": "deepseek-chat"}, clear=True):
            self.assertEqual(select_model_for_mode("quick"), "deepseek-v4-flash")
            self.assertEqual(select_model_for_mode("mastery"), "deepseek-v4-pro")

    def test_mode_models_can_be_overridden(self) -> None:
        with patch.dict("os.environ", {
            "LLM_QUICK_MODEL": "custom-quick",
            "LLM_MASTERY_MODEL": "custom-mastery",
            "LLM_MODEL": "deepseek-chat",
        }, clear=True):
            self.assertEqual(select_model_for_mode("quick"), "custom-quick")
            self.assertEqual(select_model_for_mode("mastery"), "custom-mastery")

    def test_explain_from_chunks_marks_insufficient_evidence(self) -> None:
        result = explain_from_payload({
            "fileId": "file-1",
            "fileName": "README.md",
            "mode": "quick",
            "chunks": [],
            "question": "这个文件讲了什么？",
        })

        self.assertEqual(result["summary"], "依据不足：当前文件没有可检索片段。")
        self.assertEqual(result["grounded"], False)
        self.assertEqual(result["insufficientEvidence"], True)

    def test_explain_from_chunks_returns_grounded_retrieval_metadata(self) -> None:
        result = explain_from_payload({
            "fileId": "file-1",
            "fileName": "README.md",
            "mode": "mastery",
            "question": "订单模块负责什么？",
            "chunks": [
                {
                    "content": "订单模块负责状态流转和库存扣减。",
                    "metadata": {"fileName": "README.md", "lineStart": 1, "lineEnd": 1},
                }
            ],
        })

        self.assertEqual(result["grounded"], True)
        self.assertEqual(result["insufficientEvidence"], False)
        self.assertEqual(result["metadata"]["retrievalCount"], 1)
        self.assertTrue(result["citations"])

    def test_parse_file_prefers_base64_but_returns_grounded_preview_metadata(self) -> None:
        with patch("app.engine.extract_text", return_value=(
            "# 标题\n项目背景",
            {
                "chunkMetadata": {"parser": "docling"},
                "sourceMetadata": {"parser": "docling"},
            },
        )):
            result = build_parse_result({
                "fileId": "file-1",
                "fileName": "README.md",
                "fileKind": "document",
                "contentBase64": base64.b64encode("# 标题\n项目背景".encode("utf-8")).decode("utf-8"),
            })

        self.assertEqual(result["source"]["title"], "README")
        self.assertEqual(result["metadata"]["retrievalReady"], True)
        self.assertTrue(result["preview"]["outline"])

    def test_parse_file_uses_parser_supplied_chunks_for_repository_sources(self) -> None:
        with patch("app.engine.extract_text", return_value=(
            "[file src/index.ts]\nexport const ready = true;",
            {
                "chunks": [
                    {
                        "content": "[file src/index.ts]\nexport const ready = true;",
                        "metadata": {
                            "fileName": "openai/codex",
                            "codePath": "src/index.ts",
                            "lineStart": 1,
                            "lineEnd": 1,
                            "parser": "repomix",
                        },
                    }
                ],
                "codeTree": [{"path": "src/index.ts", "language": "typescript", "lineCount": 1}],
                "chunkMetadata": {"parser": "repomix"},
                "sourceMetadata": {
                    "parser": "repomix",
                    "defaultBranch": "main",
                    "latestCommitSha": "abc123",
                },
            },
        )):
            result = build_parse_result({
                "fileId": "file-1",
                "fileName": "openai/codex",
                "fileKind": "code",
                "repositoryUrl": "https://github.com/openai/codex",
            })

        self.assertEqual(result["metadata"]["sourceMode"], "repository_url")
        self.assertEqual(result["metadata"]["parser"], "repomix")
        self.assertEqual(result["source"]["metadata"]["defaultBranch"], "main")
        self.assertEqual(result["chunks"][0]["metadata"]["codePath"], "src/index.ts")
        self.assertEqual(result["citations"][0]["codePath"], "src/index.ts")

    def test_parse_file_preserves_parser_supplied_slides(self) -> None:
        with patch("app.engine.extract_text", return_value=(
            "[slide 1]\n项目目标",
            {
                "slides": [
                    {
                        "page": 1,
                        "title": "封面",
                        "text": "项目目标",
                        "metadata": {"parser": "docling"},
                    }
                ],
                "chunkMetadata": {"parser": "docling"},
                "sourceMetadata": {"parser": "docling"},
            },
        )):
            result = build_parse_result({
                "fileId": "file-1",
                "fileName": "答辩稿.pptx",
                "fileKind": "presentation",
                "contentBase64": base64.b64encode(b"placeholder").decode("utf-8"),
            })

        self.assertEqual(result["slides"][0]["title"], "封面")
        self.assertEqual(result["metadata"]["parser"], "docling")

    def test_pptx_uses_lightweight_parser_before_docling(self) -> None:
        pptx_bytes = build_minimal_pptx("项目目标\n用 AI 生成表达地图")

        with patch("app.parsers.run_docling_conversion") as run_docling_conversion:
            text, extras = extract_document_with_docling("答辩稿.pptx", pptx_bytes)

        run_docling_conversion.assert_not_called()
        self.assertIn("项目目标", text)
        self.assertEqual(extras["chunkMetadata"]["parser"], "lightweight-zipxml")
        self.assertEqual(extras["slides"][0]["title"], "项目目标")
        self.assertIn("lightweight slide text parser", extras["sourceMetadata"]["fallbackReason"])

    def test_docling_meta_tensor_error_falls_back_to_lightweight_docx_parser(self) -> None:
        docx_bytes = build_minimal_docx("项目报告\n系统支持逐页讲稿")

        with patch(
            "app.parsers.run_docling_conversion",
            side_effect=NotImplementedError("Cannot copy out of meta tensor; no data!"),
        ):
            text, extras = extract_document_with_docling("项目报告.docx", docx_bytes)

        self.assertIn("系统支持逐页讲稿", text)
        self.assertEqual(extras["chunkMetadata"]["parser"], "lightweight-zipxml")
        self.assertIn("meta tensor", extras["sourceMetadata"]["fallbackReason"])

    def test_stream_explain_from_payload_yields_retrieval_delta_and_completion_events(self) -> None:
        events = list(stream_explain_from_payload({
            "fileId": "file-1",
            "fileName": "README.md",
            "mode": "quick",
            "chunks": [
                {
                    "content": "项目背景是减少排队时间。",
                    "metadata": {"fileName": "README.md", "lineStart": 1, "lineEnd": 1},
                }
            ],
        }))

        self.assertEqual(events[0]["event"], "started")
        self.assertEqual(events[1]["event"], "retrieval")
        self.assertTrue(any(event["event"] == "delta" for event in events))
        self.assertEqual(events[-1]["event"], "completed")
        self.assertIn("answer", events[-1]["data"])

    def test_stream_explain_from_payload_marks_fallback_when_model_is_unavailable(self) -> None:
        events = list(stream_explain_from_payload({
            "fileId": "file-1",
            "fileName": "README.md",
            "mode": "mastery",
            "question": "这个项目要解决什么问题？",
            "chunks": [
                {
                    "content": "项目目标是减少食堂排队时间。",
                    "metadata": {"fileName": "README.md", "lineStart": 1, "lineEnd": 1},
                }
            ],
        }))

        self.assertTrue(any(event["event"] == "fallback" for event in events))
        completion = events[-1]["data"]
        self.assertEqual(completion["metadata"]["fallbackUsed"], True)
        self.assertEqual(completion["metadata"]["engine"], "sidecar-deterministic")

    def test_prepare_retrieval_chunks_enriches_chunks_with_retrieval_metadata(self) -> None:
        with patch("app.engine.prepare_retrieval_chunks", return_value=[
            {
                "id": "chunk-1",
                "content": "项目目标",
                "source": "README.md · document",
                "metadata": {
                    "fileName": "README.md",
                    "sourceId": "source-file-1",
                    "lineStart": 1,
                    "lineEnd": 2,
                },
                "retrieval": {
                    "embeddingV2": [0.1, 0.2, 0.3],
                    "chunkKind": "document",
                    "sourceId": "source-file-1",
                    "retrievalText": "README.md 项目目标",
                    "lineStart": 1,
                    "lineEnd": 2,
                },
            }
        ]):
            result = prepare_retrieval_chunks_from_payload({
                "chunks": [
                    {
                        "id": "chunk-1",
                        "content": "项目目标",
                        "source": "README.md · document",
                        "metadata": {
                            "fileName": "README.md",
                            "sourceId": "source-file-1",
                            "lineStart": 1,
                            "lineEnd": 2,
                        },
                    }
                ]
            })

        self.assertEqual(result["chunks"][0]["retrieval"]["chunkKind"], "document")
        self.assertEqual(result["chunks"][0]["retrieval"]["sourceId"], "source-file-1")

    def test_retrieve_chunks_returns_hybrid_mode_and_trace(self) -> None:
        with patch("app.engine.retrieve_chunks", return_value={
            "chunks": [
                {
                    "id": "chunk-1",
                    "projectId": "project-defense",
                    "artifactId": "artifact-readme",
                    "fileId": "file-readme",
                    "content": "项目背景：解决食堂高峰期排队问题。",
                    "source": "README.md · document",
                    "metadata": {"fileName": "README.md", "lineStart": 1, "lineEnd": 1},
                    "createdAt": "2026-04-25T06:04:00.000Z",
                }
            ],
            "mode": "hybrid",
            "trace": {
                "vectorCandidateCount": 6,
                "lexicalCandidateCount": 4,
                "reranked": True,
            },
        }):
            result = retrieve_chunks_from_payload({
                "projectId": "project-defense",
                "query": "排队问题",
                "limit": 4,
                "fileId": "file-readme",
            })

        self.assertEqual(result["mode"], "hybrid")
        self.assertEqual(result["trace"]["reranked"], True)
        self.assertEqual(result["chunks"][0]["fileId"], "file-readme")


if __name__ == "__main__":
    unittest.main()
