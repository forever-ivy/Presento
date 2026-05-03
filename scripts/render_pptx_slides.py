#!/usr/bin/env python3
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"p": P_NS, "r": R_NS, "rel": REL_NS}

ET.register_namespace("p", P_NS)
ET.register_namespace("r", R_NS)


def main() -> int:
    if len(sys.argv) != 4:
        print("Usage: render_pptx_slides.py <source.pptx> <output-dir> <repo-root>", file=sys.stderr)
        return 2

    source_path = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    repo_root = Path(sys.argv[3]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not source_path.exists():
        raise FileNotFoundError(source_path)

    with zipfile.ZipFile(source_path) as archive:
        slide_count = read_slide_count(archive)

    rendered = []
    with tempfile.TemporaryDirectory(prefix="presento-pptx-slides-") as temp_name:
        temp_dir = Path(temp_name)
        for page in range(1, slide_count + 1):
            single_pptx = temp_dir / f"slide-{page}.pptx"
            make_single_slide_pptx(source_path, single_pptx, page)
            image_path = render_single_slide(single_pptx, output_dir, page)
            thumbnail_path = make_thumbnail(image_path, output_dir / f"slide-{page}-thumb.png")
            rendered.append({
                "page": page,
                "imagePath": relative_path(image_path, repo_root),
                "thumbnailPath": relative_path(thumbnail_path, repo_root),
            })

    print(json.dumps({"slides": rendered}, ensure_ascii=False))
    return 0


def read_slide_count(archive: zipfile.ZipFile) -> int:
    presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
    slide_list = presentation.find("p:sldIdLst", NS)
    if slide_list is None:
        return 0
    return len(slide_list.findall("p:sldId", NS))


def make_single_slide_pptx(source_path: Path, output_path: Path, page: int) -> None:
    with zipfile.ZipFile(source_path) as source:
        presentation = ET.fromstring(source.read("ppt/presentation.xml"))
        relationships = ET.fromstring(source.read("ppt/_rels/presentation.xml.rels"))
        slide_list = presentation.find("p:sldIdLst", NS)
        if slide_list is None:
            raise ValueError("PPTX has no slide list.")

        slide_ids = list(slide_list.findall("p:sldId", NS))
        if page < 1 or page > len(slide_ids):
            raise ValueError(f"Slide {page} is out of range.")

        selected_slide = slide_ids[page - 1]
        selected_rid = selected_slide.attrib[f"{{{R_NS}}}id"]
        for slide_id in list(slide_list):
            if slide_id is not selected_slide:
                slide_list.remove(slide_id)

        for relationship in list(relationships):
            relation_type = relationship.attrib.get("Type", "")
            relation_id = relationship.attrib.get("Id")
            if relation_type.endswith("/slide") and relation_id != selected_rid:
                relationships.remove(relationship)

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as target:
            for item in source.infolist():
                data = source.read(item.filename)
                if item.filename == "ppt/presentation.xml":
                    data = ET.tostring(presentation, encoding="utf-8", xml_declaration=True)
                elif item.filename == "ppt/_rels/presentation.xml.rels":
                    data = ET.tostring(relationships, encoding="utf-8", xml_declaration=True)
                target.writestr(item, data)


def render_single_slide(single_pptx: Path, output_dir: Path, page: int) -> Path:
    with tempfile.TemporaryDirectory(prefix="presento-ql-") as temp_name:
        temp_dir = Path(temp_name)
        completed = subprocess.run(
            ["qlmanage", "-t", "-s", "1600", "-o", str(temp_dir), str(single_pptx)],
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError((completed.stderr or completed.stdout).strip() or "Quick Look render failed.")

        candidates = sorted(temp_dir.glob(f"{single_pptx.name}*.png"))
        if not candidates:
            raise RuntimeError(f"Quick Look did not render slide {page}.")

        image_path = output_dir / f"slide-{page}.png"
        shutil.copyfile(candidates[0], image_path)
        return image_path


def make_thumbnail(image_path: Path, thumbnail_path: Path) -> Path:
    if shutil.which("sips"):
        completed = subprocess.run(
            ["sips", "-Z", "420", str(image_path), "--out", str(thumbnail_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode == 0 and thumbnail_path.exists():
            return thumbnail_path

    shutil.copyfile(image_path, thumbnail_path)
    return thumbnail_path


def relative_path(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root))
    except ValueError:
        return str(path.resolve())


if __name__ == "__main__":
    raise SystemExit(main())
