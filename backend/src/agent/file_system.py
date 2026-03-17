import os
import shutil
from pathlib import Path
from pydantic import BaseModel


WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent / "agent_workspace"


class FileNode(BaseModel):
    name: str
    path: str
    is_dir: bool
    children: list["FileNode"] = []


def ensure_workspace():
    WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)


def write_file(file_path: str, content: str) -> str:
    ensure_workspace()
    safe_path = file_path.lstrip("/")
    full_path = WORKSPACE_ROOT / safe_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content, encoding="utf-8")
    return str(full_path.relative_to(WORKSPACE_ROOT))


def read_file(file_path: str) -> str:
    ensure_workspace()
    safe_path = file_path.lstrip("/")
    full_path = WORKSPACE_ROOT / safe_path
    if not full_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    return full_path.read_text(encoding="utf-8")


def list_files(dir_path: str = "") -> list[dict]:
    ensure_workspace()
    safe_path = dir_path.lstrip("/") if dir_path else ""
    full_path = WORKSPACE_ROOT / safe_path
    if not full_path.exists():
        return []
    result = []
    for item in sorted(full_path.iterdir()):
        entry = {
            "name": item.name,
            "path": str(item.relative_to(WORKSPACE_ROOT)),
            "is_dir": item.is_dir(),
        }
        if item.is_dir():
            entry["children"] = list_files(str(item.relative_to(WORKSPACE_ROOT)))
        result.append(entry)
    return result


def get_file_tree() -> list[dict]:
    ensure_workspace()
    return list_files("")


def clear_workspace():
    if WORKSPACE_ROOT.exists():
        shutil.rmtree(WORKSPACE_ROOT)
    ensure_workspace()