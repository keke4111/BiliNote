import json
import re
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import unquote, urlparse
from zipfile import ZIP_DEFLATED, ZipFile

from app.utils.logger import get_logger

logger = get_logger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKUP_DIR = PROJECT_ROOT / "backup" / "notes"
EXPORT_DIR = BACKUP_DIR / "exports"
LATEST_BACKUP_FILE = BACKUP_DIR / "latest.task-storage.json"
SCHEMA_VERSION = 1
BACKEND_ROOT = PROJECT_ROOT / "backend"
SCREENSHOT_DIR = (BACKEND_ROOT / "static" / "screenshots").resolve()
COVER_DIR = (BACKEND_ROOT / "static" / "cover").resolve()
ALLOWED_IMAGE_ROOTS = {
    "screenshots": SCREENSHOT_DIR,
    "cover": COVER_DIR,
}
MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")


class NotesBackupService:
    @staticmethod
    def _ensure_dirs() -> None:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _now_iso() -> str:
        return datetime.now().isoformat(timespec="seconds")

    @staticmethod
    def _sanitize_snapshot(snapshot: Optional[dict]) -> dict:
        snapshot = snapshot or {}
        payload = snapshot.get("state") if isinstance(snapshot.get("state"), dict) else snapshot

        tasks = payload.get("tasks")
        categories = payload.get("categories")
        deleted_versions = payload.get("deletedVersions")

        return {
            "schemaVersion": snapshot.get("schemaVersion") or payload.get("schemaVersion") or SCHEMA_VERSION,
            "exportedAt": snapshot.get("exportedAt") or payload.get("exportedAt") or NotesBackupService._now_iso(),
            "tasks": tasks if isinstance(tasks, list) else [],
            "categories": categories if isinstance(categories, list) else [],
            "deletedVersions": deleted_versions if isinstance(deleted_versions, list) else [],
            "currentTaskId": payload.get("currentTaskId"),
        }

    @staticmethod
    def _iter_markdown_contents(snapshot: dict):
        for task in snapshot.get("tasks", []):
            markdown = task.get("markdown") if isinstance(task, dict) else None
            if isinstance(markdown, str):
                yield markdown
            elif isinstance(markdown, list):
                for version in markdown:
                    if isinstance(version, dict) and isinstance(version.get("content"), str):
                        yield version["content"]

        for item in snapshot.get("deletedVersions", []):
            if not isinstance(item, dict):
                continue
            version = item.get("version")
            if isinstance(version, dict) and isinstance(version.get("content"), str):
                yield version["content"]

    @staticmethod
    def _resolve_local_image(url: str) -> Optional[tuple[str, Path]]:
        parsed = urlparse(url)
        if parsed.scheme and parsed.scheme not in {"http", "https"}:
            return None
        if parsed.scheme in {"http", "https"} and parsed.hostname not in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            return None

        path = unquote(parsed.path)
        if path.startswith("/static/screenshots/"):
            image_type = "screenshots"
        elif path.startswith("/static/cover/"):
            image_type = "cover"
        else:
            return None

        root = ALLOWED_IMAGE_ROOTS[image_type]
        candidate = (root / Path(path).name).resolve()
        if not (root == candidate or root in candidate.parents):
            logger.warning(f"跳过不安全的备份图片路径: {url}")
            return None
        if not candidate.is_file():
            logger.warning(f"跳过不存在的备份图片: {candidate}")
            return None
        return image_type, candidate

    @staticmethod
    def _collect_local_images(snapshot: dict) -> Dict[str, Path]:
        images: Dict[str, Path] = {}
        used_names: Dict[str, int] = {}

        for markdown in NotesBackupService._iter_markdown_contents(snapshot):
            for match in MARKDOWN_IMAGE_RE.finditer(markdown):
                resolved = NotesBackupService._resolve_local_image(match.group(1).strip())
                if resolved is None:
                    continue

                image_type, image_path = resolved
                base_name = image_path.name
                output_name = base_name
                key_base = f"{image_type}/{base_name}".lower()
                if key_base in used_names:
                    used_names[key_base] += 1
                    output_name = f"{image_path.stem}_{used_names[key_base]}{image_path.suffix}"
                else:
                    used_names[key_base] = 1

                images[f"assets/{image_type}/{output_name}"] = image_path
        return images

    @staticmethod
    def _safe_asset_target(member_name: str) -> Optional[Path]:
        path = Path(member_name)
        parts = path.parts
        if len(parts) != 3 or parts[0] != "assets" or parts[1] not in ALLOWED_IMAGE_ROOTS:
            return None
        filename = Path(parts[2]).name
        if filename != parts[2]:
            return None
        target = (ALLOWED_IMAGE_ROOTS[parts[1]] / filename).resolve()
        root = ALLOWED_IMAGE_ROOTS[parts[1]]
        if not (root == target or root in target.parents):
            return None
        return target

    @staticmethod
    def _write_json_atomic(path: Path, payload: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp_path.replace(path)

    @staticmethod
    def _count_deleted_tasks(tasks: List[dict]) -> int:
        return sum(1 for task in tasks if isinstance(task, dict) and task.get("isDeleted"))

    @staticmethod
    def _serialize_backup_file(path: Path, is_latest: bool = False) -> dict:
        data = NotesBackupService._load_snapshot(path)
        return {
            "name": path.name,
            "relativePath": str(path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "size": path.stat().st_size,
            "isLatest": is_latest,
            "exportedAt": data.get("exportedAt"),
            "taskCount": len(data.get("tasks", [])),
            "deletedTaskCount": NotesBackupService._count_deleted_tasks(data.get("tasks", [])),
            "deletedVersionCount": len(data.get("deletedVersions", [])),
        }

    @staticmethod
    def _resolve_import_path(filename: str) -> Path:
        safe_name = Path(filename).name
        if safe_name == LATEST_BACKUP_FILE.name:
            target = LATEST_BACKUP_FILE
        else:
            target = EXPORT_DIR / safe_name

        resolved = target.resolve()
        allowed_roots = [BACKUP_DIR.resolve(), EXPORT_DIR.resolve()]
        if not any(root == resolved or root in resolved.parents for root in allowed_roots):
            raise ValueError("非法备份文件路径")
        return resolved

    @staticmethod
    def _load_snapshot(path: Path) -> dict:
        if not path.exists():
            raise FileNotFoundError(f"备份文件不存在: {path.name}")
        raw = json.loads(path.read_text(encoding="utf-8"))
        return NotesBackupService._sanitize_snapshot(raw)

    @staticmethod
    def sync_latest(snapshot: Optional[dict]) -> dict:
        NotesBackupService._ensure_dirs()
        payload = NotesBackupService._sanitize_snapshot(snapshot)
        NotesBackupService._write_json_atomic(LATEST_BACKUP_FILE, payload)
        logger.info(f"笔记库备份已同步: {LATEST_BACKUP_FILE}")
        return {
            "path": str(LATEST_BACKUP_FILE.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "taskCount": len(payload["tasks"]),
            "deletedTaskCount": NotesBackupService._count_deleted_tasks(payload["tasks"]),
            "deletedVersionCount": len(payload["deletedVersions"]),
            "exportedAt": payload["exportedAt"],
            "schemaVersion": payload["schemaVersion"],
        }

    @staticmethod
    def get_status() -> dict:
        NotesBackupService._ensure_dirs()
        if not LATEST_BACKUP_FILE.exists():
            return {
                "backupExists": False,
                "backupTaskCount": 0,
                "backupDeletedTaskCount": 0,
                "backupDeletedVersionCount": 0,
                "lastBackupAt": None,
                "schemaVersion": None,
                "path": str(LATEST_BACKUP_FILE.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            }

        data = NotesBackupService._load_snapshot(LATEST_BACKUP_FILE)
        return {
            "backupExists": True,
            "backupTaskCount": len(data["tasks"]),
            "backupDeletedTaskCount": NotesBackupService._count_deleted_tasks(data["tasks"]),
            "backupDeletedVersionCount": len(data["deletedVersions"]),
            "lastBackupAt": data.get("exportedAt"),
            "schemaVersion": data.get("schemaVersion"),
            "path": str(LATEST_BACKUP_FILE.relative_to(PROJECT_ROOT)).replace("\\", "/"),
        }

    @staticmethod
    def export_snapshot(snapshot: Optional[dict]) -> dict:
        NotesBackupService._ensure_dirs()
        payload = NotesBackupService._sanitize_snapshot(snapshot)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        export_path = EXPORT_DIR / f"notes-export-{timestamp}.json"
        NotesBackupService._write_json_atomic(export_path, payload)
        logger.info(f"笔记库导出完成: {export_path}")
        return NotesBackupService._serialize_backup_file(export_path)

    @staticmethod
    def export_bundle(snapshot: Optional[dict]) -> tuple[bytes, str]:
        payload = NotesBackupService._sanitize_snapshot(snapshot)
        images = NotesBackupService._collect_local_images(payload)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        filename = f"notes-backup-{timestamp}.zip"

        buffer = BytesIO()
        with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as zip_file:
            zip_file.writestr(
                "task-storage.json",
                json.dumps(payload, ensure_ascii=False, indent=2),
            )
            for archive_name, image_path in images.items():
                zip_file.write(image_path, archive_name)

        logger.info(f"完整笔记库备份包导出完成: {filename}, images={len(images)}")
        return buffer.getvalue(), filename

    @staticmethod
    def import_bundle(content: bytes) -> dict:
        restored = []
        skipped = []

        with ZipFile(BytesIO(content), "r") as zip_file:
            if "task-storage.json" not in zip_file.namelist():
                raise ValueError("备份包缺少 task-storage.json")

            snapshot = NotesBackupService._sanitize_snapshot(
                json.loads(zip_file.read("task-storage.json").decode("utf-8"))
            )

            for member in zip_file.infolist():
                if member.is_dir() or member.filename == "task-storage.json":
                    continue

                target = NotesBackupService._safe_asset_target(member.filename)
                if target is None:
                    skipped.append(member.filename)
                    continue

                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    skipped.append(member.filename)
                    continue

                target.write_bytes(zip_file.read(member))
                restored.append(member.filename)

        return {
            "snapshot": snapshot,
            "restoredImages": restored,
            "skippedImages": skipped,
        }

    @staticmethod
    def list_backups() -> List[dict]:
        NotesBackupService._ensure_dirs()
        files: List[dict] = []

        if LATEST_BACKUP_FILE.exists():
            files.append(NotesBackupService._serialize_backup_file(LATEST_BACKUP_FILE, is_latest=True))

        export_files = sorted(
            EXPORT_DIR.glob("notes-export-*.json"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        files.extend(NotesBackupService._serialize_backup_file(path) for path in export_files)
        return files

    @staticmethod
    def load_backup_file(filename: str) -> dict:
        path = NotesBackupService._resolve_import_path(filename)
        data = NotesBackupService._load_snapshot(path)
        return {
            "file": NotesBackupService._serialize_backup_file(path, is_latest=path == LATEST_BACKUP_FILE),
            "snapshot": data,
        }
