import json
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from html import unescape
from pathlib import Path
from typing import Any
from xml.etree import ElementTree


def extract_text(
    file_name: str,
    file_kind: str,
    data: bytes | None = None,
    repository_url: str | None = None,
) -> tuple[str, dict[str, Any]]:
    if repository_url or file_kind == "code":
        if not repository_url:
            raise ValueError("Code parsing now requires a public GitHub repository URL.")
        return extract_repository_with_repomix(repository_url)

    if data is None:
        raise ValueError("Document payload bytes are required.")

    return extract_document_with_docling(file_name, data)


def extract_document_with_docling(file_name: str, data: bytes) -> tuple[str, dict[str, Any]]:
    suffix = Path(file_name).suffix.lower() or ".txt"
    with tempfile.TemporaryDirectory(prefix="presento-docling-") as temp_dir:
        temp_path = Path(temp_dir)
        input_path = temp_path / sanitize_filename(file_name, fallback=f"source{suffix}")
        input_path.write_bytes(data)

        parser_name = "docling"
        source_path = input_path
        source_metadata: dict[str, Any] = {
            "parser": parser_name,
            "sourceFormat": suffix.lstrip("."),
        }

        try:
            if suffix in {".ppt", ".pptx"}:
                source_path = convert_presentation_with_libreoffice(input_path, temp_path)
                source_metadata.update({
                    "convertedFrom": suffix.lstrip("."),
                    "convertedTo": "pdf",
                    "conversionEngine": "libreoffice",
                })

            conversion = run_docling_conversion(source_path)
        except (FileNotFoundError, ValueError, subprocess.SubprocessError) as exc:
            return extract_document_with_lightweight_parser(file_name, data, str(exc))

        document = read_docling_document(conversion)
        document_dict = export_docling_document_dict(document)
        page_mode = "slide" if suffix in {".ppt", ".pptx"} else "page"
        page_entries = group_docling_entries_by_page(collect_docling_text_entries(document_dict))

        if page_entries:
            text = compose_paginated_text(page_entries, page_mode)
        else:
            text = export_docling_text(document)

        text = text.strip()
        if not text:
            raise ValueError(f"Docling did not extract readable content from {file_name}.")

        slides = build_page_records(page_entries, page_mode) if page_mode == "slide" else []
        tables = extract_docling_tables(document)

        return text, {
            "slides": slides,
            "tables": tables,
            "chunkMetadata": {
                "parser": parser_name,
            },
            "sourceMetadata": source_metadata,
        }


def extract_document_with_lightweight_parser(
    file_name: str,
    data: bytes,
    fallback_reason: str,
) -> tuple[str, dict[str, Any]]:
    suffix = Path(file_name).suffix.lower()
    parser_name = "lightweight-zipxml"
    source_metadata = {
        "parser": parser_name,
        "sourceFormat": suffix.lstrip("."),
        "fallbackReason": fallback_reason,
    }

    if suffix == ".docx":
        text = extract_docx_text(data)
        if not text:
            raise ValueError(f"Could not extract readable text from {file_name}.")
        return text, {
            "chunkMetadata": {
                "parser": parser_name,
            },
            "sourceMetadata": source_metadata,
        }

    if suffix == ".pptx":
        slides = extract_pptx_slides(data)
        text = "\n\n".join(
            f"[slide {slide['page']}]\n{slide['text']}"
            for slide in slides
            if slide.get("text")
        ).strip()
        if not text:
            raise ValueError(f"Could not extract readable slide text from {file_name}.")
        return text, {
            "slides": slides,
            "chunkMetadata": {
                "parser": parser_name,
            },
            "sourceMetadata": source_metadata,
        }

    if suffix in {".md", ".txt", ".csv", ".sql"}:
        text = decode_text_payload(data)
        if not text:
            raise ValueError(f"Could not decode readable text from {file_name}.")
        return text, {
            "chunkMetadata": {
                "parser": parser_name,
            },
            "sourceMetadata": source_metadata,
        }

    raise ValueError(fallback_reason)


def extract_docx_text(data: bytes) -> str:
    with zipfile.ZipFile(io_bytes(data)) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")

    root = ElementTree.fromstring(xml)
    paragraphs: list[str] = []
    for paragraph in root.iter():
        if local_name(paragraph.tag) != "p":
            continue
        texts = [
            unescape(child.text or "")
            for child in paragraph.iter()
            if local_name(child.tag) == "t" and child.text
        ]
        line = "".join(texts).strip()
        if line:
            paragraphs.append(line)
    return "\n".join(paragraphs)


def extract_pptx_slides(data: bytes) -> list[dict[str, Any]]:
    with zipfile.ZipFile(io_bytes(data)) as archive:
        slide_names = sorted(
            (
                name
                for name in archive.namelist()
                if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
            ),
            key=slide_sort_key,
        )
        slides = []
        for index, slide_name in enumerate(slide_names, start=1):
            xml = archive.read(slide_name).decode("utf-8", errors="ignore")
            root = ElementTree.fromstring(xml)
            lines = [
                unescape(node.text or "").strip()
                for node in root.iter()
                if local_name(node.tag) == "t" and node.text and node.text.strip()
            ]
            text = "\n".join(lines)
            if not text:
                continue
            slides.append({
                "page": index,
                "title": first_line(text) or f"Slide {index}",
                "text": text,
                "metadata": {
                    "parser": "lightweight-zipxml",
                },
            })
    return slides


def decode_text_payload(data: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "gb18030", "latin-1"):
        try:
            return data.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return ""


def io_bytes(data: bytes):
    import io

    return io.BytesIO(data)


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def slide_sort_key(name: str) -> int:
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else 0


def extract_repository_with_repomix(repository_url: str) -> tuple[str, dict[str, Any]]:
    repo_metadata = fetch_github_repository_metadata(repository_url)
    repomix_payload = run_repomix_remote(
        repo_metadata["url"],
        repo_metadata.get("defaultBranch"),
    )
    code_files = normalize_repomix_files(repomix_payload)

    if not code_files:
        raise ValueError("Repomix did not return any readable source files.")

    text_blocks: list[str] = []
    code_tree: list[dict[str, Any]] = []
    chunks: list[dict[str, Any]] = []
    for file_entry in code_files:
        path = file_entry["path"]
        content = file_entry["content"].strip()
        if not content:
            continue

        language = file_entry.get("language") or language_for_path(path)
        line_count = len(content.splitlines()) or 1
        text_blocks.append(f"[file {path}]\n{content}")
        code_tree.append({
            "path": path,
            "language": language,
            "summary": file_entry.get("summary") or f"{line_count} lines",
            "lineCount": line_count,
        })
        chunks.extend(build_code_chunks(path, content, language))

    if not text_blocks:
        raise ValueError("Repomix returned only empty files.")

    return "\n\n".join(text_blocks), {
        "chunks": chunks,
        "codeTree": code_tree,
        "chunkMetadata": {
            "parser": "repomix",
        },
        "sourceMetadata": {
            "parser": "repomix",
            "repositoryUrl": repo_metadata["url"],
            **({"defaultBranch": repo_metadata["defaultBranch"]} if repo_metadata.get("defaultBranch") else {}),
            **({"latestCommitSha": repo_metadata["latestCommitSha"]} if repo_metadata.get("latestCommitSha") else {}),
        },
    }


def run_docling_conversion(source_path: Path) -> Any:
    try:
        from docling.document_converter import DocumentConverter
    except ModuleNotFoundError as exc:
        raise ValueError("Docling is not installed in the parser sidecar.") from exc

    converter = DocumentConverter()
    return converter.convert(source_path)


def read_docling_document(conversion: Any) -> Any:
    document = getattr(conversion, "document", None)
    if document is None:
        raise ValueError("Docling conversion did not return a document payload.")
    return document


def export_docling_document_dict(document: Any) -> dict[str, Any]:
    if hasattr(document, "export_to_dict"):
        exported = document.export_to_dict()
        if isinstance(exported, dict):
            return exported
    return {}


def export_docling_text(document: Any) -> str:
    if hasattr(document, "export_to_markdown"):
        markdown = document.export_to_markdown()
        if isinstance(markdown, str) and markdown.strip():
            return markdown

    if hasattr(document, "export_to_text"):
        plain_text = document.export_to_text(page_break_placeholder="\n\n[page-break]\n\n")
        if isinstance(plain_text, str) and plain_text.strip():
            return plain_text

    raise ValueError("Docling document could not be exported to text.")


def collect_docling_text_entries(node: Any) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    seen: set[tuple[int | None, str]] = set()

    def visit(current: Any) -> None:
        if isinstance(current, dict):
            text = current.get("text")
            page = read_page_no(current)
            if isinstance(text, str):
                normalized = normalize_doc_text(text)
                if normalized:
                    key = (page, normalized)
                    if key not in seen:
                        seen.add(key)
                        entries.append({
                            "page": page,
                            "text": normalized,
                            "label": str(current.get("label") or current.get("type") or ""),
                        })
            for value in current.values():
                visit(value)
            return

        if isinstance(current, list):
            for item in current:
                visit(item)

    visit(node)
    return entries


def read_page_no(node: dict[str, Any]) -> int | None:
    direct = node.get("page_no")
    if isinstance(direct, int) and direct > 0:
        return direct

    provenance = node.get("prov") or node.get("provenance")
    if isinstance(provenance, list):
        for item in provenance:
            if isinstance(item, dict):
                page_no = item.get("page_no") or item.get("page")
                if isinstance(page_no, int) and page_no > 0:
                    return page_no

    if isinstance(provenance, dict):
        page_no = provenance.get("page_no") or provenance.get("page")
        if isinstance(page_no, int) and page_no > 0:
            return page_no

    return None


def group_docling_entries_by_page(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[int, list[dict[str, Any]]] = {}
    for entry in entries:
        page = entry.get("page")
        if isinstance(page, int) and page > 0:
            grouped.setdefault(page, []).append(entry)

    return [
        {
            "page": page,
            "entries": grouped[page],
        }
        for page in sorted(grouped)
    ]


def compose_paginated_text(page_entries: list[dict[str, Any]], page_mode: str) -> str:
    blocks: list[str] = []
    for page_entry in page_entries:
        page = page_entry["page"]
        lines = [entry["text"] for entry in page_entry["entries"] if entry["text"]]
        if not lines:
            continue
        blocks.append(f"[{page_mode} {page}]\n" + "\n".join(lines))
    return "\n\n".join(blocks)


def build_page_records(page_entries: list[dict[str, Any]], page_mode: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for page_entry in page_entries:
        texts = [entry["text"] for entry in page_entry["entries"] if entry["text"]]
        if not texts:
            continue
        title = select_page_title(page_entry["entries"], page_entry["page"], page_mode)
        records.append({
            "page": page_entry["page"],
            "title": title,
            "text": "\n".join(texts),
            "metadata": {
                "parser": "docling",
            },
        })
    return records


def select_page_title(entries: list[dict[str, Any]], page: int, page_mode: str) -> str:
    for entry in entries:
        label = entry.get("label", "").lower()
        text = entry.get("text", "")
        if label in {"title", "heading", "section_header"} and text:
            return text[:120]
    first_text = next((entry.get("text", "") for entry in entries if entry.get("text")), "")
    if first_text:
        return first_text.splitlines()[0][:120]
    return f"{page_mode.title()} {page}"


def extract_docling_tables(document: Any) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    for index, table in enumerate(getattr(document, "tables", []) or [], start=1):
        try:
            dataframe = table.export_to_dataframe(doc=document)
        except Exception:
            continue

        headers = [str(column) for column in list(getattr(dataframe, "columns", []))]
        rows = dataframe.head(20).values.tolist() if hasattr(dataframe, "head") and hasattr(dataframe, "values") else []
        tables.append({
            "title": f"Table {index}",
            "headers": headers,
            "rows": [[normalize_table_value(value) for value in row] for row in rows],
            "metadata": {
                "parser": "docling",
            },
        })
    return tables


def normalize_table_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def build_code_chunks(path: str, content: str, language: str) -> list[dict[str, Any]]:
    lines = content.splitlines() or [content]
    chunks: list[dict[str, Any]] = []
    current_lines: list[str] = []
    start_line = 1

    for index, line in enumerate(lines, start=1):
        if current_lines and (len("\n".join(current_lines)) + len(line) > 1400 or len(current_lines) >= 80):
            chunks.append(make_code_chunk(path, language, current_lines, start_line, index - 1))
            current_lines = []
            start_line = index
        current_lines.append(line)

    if current_lines:
        chunks.append(make_code_chunk(path, language, current_lines, start_line, len(lines)))

    return chunks


def make_code_chunk(
    path: str,
    language: str,
    lines: list[str],
    start_line: int,
    end_line: int,
) -> dict[str, Any]:
    return {
        "content": f"[file {path}]\n" + "\n".join(lines),
        "source": path,
        "metadata": {
            "fileName": path,
            "codePath": path,
            "language": language,
            "lineStart": start_line,
            "lineEnd": end_line,
            "parser": "repomix",
        },
    }


def run_repomix_remote(repository_url: str, branch: str | None = None) -> dict[str, Any]:
    command = [
        "repomix",
        "--remote",
        repository_url,
        "--style",
        "json",
        "--stdout",
        "--quiet",
    ]
    if branch:
        command.extend(["--remote-branch", branch])

    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise ValueError(
            f"Repomix failed for {repository_url}: {(completed.stderr or completed.stdout).strip() or completed.returncode}"
        )

    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise ValueError("Repomix did not return valid JSON output.") from exc


def normalize_repomix_files(payload: dict[str, Any]) -> list[dict[str, Any]]:
    files = payload.get("files")
    normalized: list[dict[str, Any]] = []

    if isinstance(files, dict):
        for path, value in files.items():
            if isinstance(value, dict):
                content = read_repomix_content(value)
                normalized.append({
                    "path": path,
                    "content": content,
                    "language": value.get("language") or language_for_path(path),
                    "summary": value.get("summary"),
                })
            elif isinstance(value, str):
                normalized.append({
                    "path": path,
                    "content": value,
                    "language": language_for_path(path),
                })
        return normalized

    if isinstance(files, list):
        for entry in files:
            if not isinstance(entry, dict):
                continue
            path = str(entry.get("path") or entry.get("filePath") or "").strip()
            content = read_repomix_content(entry)
            if not path or not content:
                continue
            normalized.append({
                "path": path,
                "content": content,
                "language": entry.get("language") or language_for_path(path),
                "summary": entry.get("summary"),
            })
        return normalized

    return normalized


def read_repomix_content(entry: dict[str, Any]) -> str:
    for key in ("content", "code", "text"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return ""


def fetch_github_repository_metadata(repository_url: str) -> dict[str, Any]:
    parsed = parse_github_repository_url(repository_url)
    repository_payload = read_github_api_json(
        f"https://api.github.com/repos/{parsed['owner']}/{parsed['repo']}"
    )

    if repository_payload.get("private"):
        raise ValueError("Only public GitHub repositories are supported.")

    default_branch = repository_payload.get("default_branch")
    latest_commit_sha = None
    if isinstance(default_branch, str) and default_branch.strip():
        branch = default_branch.strip()
        try:
            commit_payload = read_github_api_json(
                f"https://api.github.com/repos/{parsed['owner']}/{parsed['repo']}/commits/{urllib.parse.quote(branch)}"
            )
            commit_sha = commit_payload.get("sha")
            latest_commit_sha = commit_sha.strip() if isinstance(commit_sha, str) and commit_sha.strip() else None
        except Exception:
            latest_commit_sha = None
    else:
        branch = None

    return {
        **parsed,
        **({"defaultBranch": branch} if branch else {}),
        **({"latestCommitSha": latest_commit_sha} if latest_commit_sha else {}),
    }


def parse_github_repository_url(repository_url: str) -> dict[str, str]:
    parsed = urllib.parse.urlparse(repository_url)
    if parsed.scheme not in {"http", "https"} or parsed.netloc != "github.com":
        raise ValueError("Only public GitHub repositories are supported.")

    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        raise ValueError("Please provide a full GitHub repository URL.")

    owner, raw_repo = parts[0], parts[1]
    repo = raw_repo.removesuffix(".git").strip()
    if not owner or not repo:
        raise ValueError("Please provide a full GitHub repository URL.")

    return {
        "owner": owner,
        "repo": repo,
        "url": f"https://github.com/{owner}/{repo}",
    }


def read_github_api_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "presento-notebook-rag",
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise ValueError("GitHub repository not found, or it is not publicly accessible.") from exc
        if exc.code == 403:
            raise ValueError("GitHub repository lookup is temporarily rate-limited. Please try again later.") from exc
        raise ValueError(f"GitHub repository lookup failed: {exc.code}") from exc


def convert_presentation_with_libreoffice(input_path: Path, temp_path: Path) -> Path:
    completed = subprocess.run(
        [
            "libreoffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(temp_path),
            str(input_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise ValueError(
            f"LibreOffice conversion failed for {input_path.name}: {(completed.stderr or completed.stdout).strip() or completed.returncode}"
        )

    converted_path = temp_path / f"{input_path.stem}.pdf"
    if not converted_path.exists():
        raise ValueError(f"LibreOffice did not produce a PDF for {input_path.name}.")
    return converted_path


def sanitize_filename(file_name: str, fallback: str = "source.txt") -> str:
    candidate = re.sub(r"[^A-Za-z0-9._-]+", "-", file_name).strip("-")
    return candidate[:120] or fallback


def normalize_doc_text(text: str) -> str:
    normalized = text.replace("\u0000", "").strip()
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized


def chunk_text(text: str, file_name: str, metadata: dict[str, Any]) -> list[dict[str, Any]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    chunks = []
    current: list[str] = []
    start_line = 1
    for index, line in enumerate(lines, start=1):
        if current and sum(len(item) for item in current) + len(line) > 1200:
            chunks.append(make_chunk(file_name, current, start_line, index - 1, metadata))
            current = []
            start_line = index
        current.append(line)
    if current:
        chunks.append(make_chunk(file_name, current, start_line, len(lines), metadata))
    return chunks


def make_chunk(file_name: str, lines: list[str], start_line: int, end_line: int, metadata: dict[str, Any]) -> dict[str, Any]:
    content = "\n".join(lines)
    page = infer_marker_number(content, "page")
    slide = infer_marker_number(content, "slide")
    sheet = infer_sheet_name(content)
    code_path = infer_code_path(content)
    return {
        "content": content,
        "source": file_name,
        "metadata": {
            **metadata,
            "fileName": file_name,
            "lineStart": start_line,
            "lineEnd": end_line,
            **({"page": page} if page else {}),
            **({"slide": slide} if slide else {}),
            **({"sheet": sheet} if sheet else {}),
            **({"codePath": code_path} if code_path else {}),
        },
    }


def citation_from_chunk(file_name: str, chunk: dict[str, Any]) -> dict[str, Any]:
    metadata = chunk.get("metadata") or {}
    return {
        "fileName": metadata.get("fileName", file_name),
        "page": metadata.get("page"),
        "slide": metadata.get("slide"),
        "sheet": metadata.get("sheet"),
        "cellRange": metadata.get("cellRange"),
        "codePath": metadata.get("codePath"),
        "lineStart": metadata.get("lineStart"),
        "lineEnd": metadata.get("lineEnd"),
        "text": first_line(chunk.get("content") or ""),
    }


def infer_outline(text: str) -> list[str]:
    headings = []
    for line in text.splitlines():
        cleaned = re.sub(r"^#+\s*", "", line).strip()
        if cleaned and (line.startswith("#") or len(cleaned) < 60):
            headings.append(cleaned)
        if len(headings) >= 8:
            break
    return headings


def summarize_text(text: str, file_name: str) -> str:
    line_count = len([line for line in text.splitlines() if line.strip()])
    return f"{file_name} 已解析为 {line_count} 行可学习内容。"


def title_from_filename(file_name: str) -> str:
    return re.sub(r"\.[^.]+$", "", file_name).strip() or file_name


def first_line(text: str) -> str:
    return next((line.strip() for line in text.splitlines() if line.strip()), "")


def infer_marker_number(text: str, marker: str) -> int | None:
    match = re.search(rf"\[{marker}\s+(\d+)\]", text, flags=re.IGNORECASE)
    return int(match.group(1)) if match else None


def infer_sheet_name(text: str) -> str | None:
    match = re.search(r"\[sheet\s+([^\]]+)\]", text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else None


def infer_code_path(text: str) -> str | None:
    file_marker = re.search(r"\[file\s+([^\]]+)\]", text, flags=re.IGNORECASE)
    if file_marker:
        return file_marker.group(1).strip()
    match = re.search(r"---\s+(.+?)\s+---", text)
    return match.group(1).strip() if match else None


def language_for_path(path: str) -> str:
    extension = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return {
        "ts": "typescript",
        "tsx": "typescriptreact",
        "js": "javascript",
        "jsx": "javascriptreact",
        "py": "python",
        "sql": "sql",
        "md": "markdown",
        "java": "java",
        "kt": "kotlin",
        "json": "json",
        "yml": "yaml",
        "yaml": "yaml",
        "go": "go",
        "rs": "rust",
    }.get(extension, extension or "text")
