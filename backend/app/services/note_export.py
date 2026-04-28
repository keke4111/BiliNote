import re
import logging
from io import BytesIO
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import unquote, urlparse
from zipfile import ZIP_DEFLATED, ZipFile

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = PROJECT_ROOT / "backend"
SCREENSHOT_DIR = (BACKEND_ROOT / "static" / "screenshots").resolve()
COVER_DIR = (BACKEND_ROOT / "static" / "cover").resolve()
ALLOWED_IMAGE_ROOTS = (SCREENSHOT_DIR, COVER_DIR)

MARKDOWN_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")


def sanitize_export_name(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value or "").strip(" .")
    return cleaned[:80] or "note"


class MarkdownBundleExporter:
    @staticmethod
    def _is_relative_or_local_image(url: str) -> bool:
        parsed = urlparse(url)
        if parsed.scheme and parsed.scheme not in {"http", "https"}:
            return False
        if parsed.scheme in {"http", "https"} and parsed.hostname not in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            return False

        return parsed.path.startswith("/static/screenshots/") or parsed.path.startswith(
            "/static/cover/"
        )

    @staticmethod
    def _resolve_local_image(url: str) -> Optional[Path]:
        if not MarkdownBundleExporter._is_relative_or_local_image(url):
            return None

        parsed = urlparse(url)
        path = unquote(parsed.path)
        if path.startswith("/static/screenshots/"):
            candidate = (SCREENSHOT_DIR / Path(path).name).resolve()
        elif path.startswith("/static/cover/"):
            candidate = (COVER_DIR / Path(path).name).resolve()
        else:
            return None

        if not any(root == candidate or root in candidate.parents for root in ALLOWED_IMAGE_ROOTS):
            logger.warning(f"跳过不安全的 Markdown 图片路径: {url}")
            return None
        if not candidate.exists() or not candidate.is_file():
            logger.warning(f"跳过不存在的 Markdown 图片: {candidate}")
            return None
        return candidate

    @staticmethod
    def _dedupe_name(filename: str, used_names: Dict[str, int]) -> str:
        safe_name = sanitize_export_name(Path(filename).stem)
        suffix = Path(filename).suffix or ".jpg"
        base = f"{safe_name}{suffix}"
        if base not in used_names:
            used_names[base] = 1
            return base

        used_names[base] += 1
        return f"{safe_name}_{used_names[base]}{suffix}"

    @staticmethod
    def build_zip(title: str, markdown: str) -> tuple[bytes, str]:
        folder_name = sanitize_export_name(title)
        image_entries: Dict[str, Path] = {}
        used_names: Dict[str, int] = {}

        def replace_image(match: re.Match) -> str:
            alt_text = match.group(1)
            original_url = match.group(2).strip()
            image_path = MarkdownBundleExporter._resolve_local_image(original_url)
            if image_path is None:
                return match.group(0)

            image_name = MarkdownBundleExporter._dedupe_name(image_path.name, used_names)
            image_entries[image_name] = image_path
            return f"![{alt_text}](assets/images/{image_name})"

        bundled_markdown = MARKDOWN_IMAGE_RE.sub(replace_image, markdown or "")

        buffer = BytesIO()
        with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as zip_file:
            zip_file.writestr(f"{folder_name}/", "")
            zip_file.writestr(f"{folder_name}/assets/", "")
            zip_file.writestr(f"{folder_name}/assets/images/", "")
            zip_file.writestr(f"{folder_name}/note.md", bundled_markdown)
            for image_name, image_path in image_entries.items():
                zip_file.write(image_path, f"{folder_name}/assets/images/{image_name}")

        return buffer.getvalue(), f"{folder_name}.zip"
