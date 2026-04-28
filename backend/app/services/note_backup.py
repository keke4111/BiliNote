import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.utils.logger import get_logger

logger = get_logger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKUP_DIR = PROJECT_ROOT / "backup" / "notes"
EXPORT_DIR = BACKUP_DIR / "exports"
LATEST_BACKUP_FILE = BACKUP_DIR / "latest.task-storage.json"
SCHEMA_VERSION = 1


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
