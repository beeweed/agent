import os
import json
from typing import Any

VIRTUAL_FS_ROOT = "/workspace/vibe-coder/virtual_fs"

def ensure_virtual_fs():
    """Ensure the virtual file system root exists."""
    os.makedirs(VIRTUAL_FS_ROOT, exist_ok=True)

def file_write(file_path: str, operations: list[dict]) -> dict:
    """
    Creates or writes to a file in the virtual file system.
    
    Args:
        file_path: The path where the file should be created (relative to virtual fs root)
        operations: List of operations to perform, each with 'type' and 'content' keys
    
    Returns:
        A dictionary with the result of the operation
    """
    ensure_virtual_fs()
    
    try:
        if file_path.startswith('/'):
            file_path = file_path[1:]
        
        full_path = os.path.join(VIRTUAL_FS_ROOT, file_path)
        
        safe_path = os.path.abspath(full_path)
        if not safe_path.startswith(os.path.abspath(VIRTUAL_FS_ROOT)):
            return {
                "success": False,
                "error": "Path traversal detected. Operation denied.",
                "file_path": file_path
            }
        
        dir_path = os.path.dirname(safe_path)
        os.makedirs(dir_path, exist_ok=True)
        
        for operation in operations:
            op_type = operation.get("type", "write")
            content = operation.get("content", "")
            
            if op_type == "write":
                with open(safe_path, 'w', encoding='utf-8') as f:
                    f.write(content)
            elif op_type == "append":
                with open(safe_path, 'a', encoding='utf-8') as f:
                    f.write(content)
            else:
                return {
                    "success": False,
                    "error": f"Unknown operation type: {op_type}",
                    "file_path": file_path
                }
        
        return {
            "success": True,
            "message": f"Successfully created/wrote file at {file_path}",
            "file_path": file_path,
            "full_path": safe_path
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "file_path": file_path
        }

def get_file_tree() -> dict:
    """Get the entire virtual file system tree structure."""
    ensure_virtual_fs()
    
    def build_tree(path: str) -> list:
        items = []
        try:
            entries = sorted(os.listdir(path))
            for entry in entries:
                entry_path = os.path.join(path, entry)
                relative_path = os.path.relpath(entry_path, VIRTUAL_FS_ROOT)
                
                if os.path.isdir(entry_path):
                    items.append({
                        "name": entry,
                        "type": "folder",
                        "path": "/" + relative_path,
                        "children": build_tree(entry_path)
                    })
                else:
                    items.append({
                        "name": entry,
                        "type": "file",
                        "path": "/" + relative_path
                    })
        except Exception:
            pass
        return items
    
    return {
        "name": "project",
        "type": "folder",
        "path": "/",
        "children": build_tree(VIRTUAL_FS_ROOT)
    }

def read_file(file_path: str) -> dict:
    """Read a file from the virtual file system."""
    ensure_virtual_fs()
    
    try:
        if file_path.startswith('/'):
            file_path = file_path[1:]
        
        full_path = os.path.join(VIRTUAL_FS_ROOT, file_path)
        
        safe_path = os.path.abspath(full_path)
        if not safe_path.startswith(os.path.abspath(VIRTUAL_FS_ROOT)):
            return {
                "success": False,
                "error": "Path traversal detected. Operation denied."
            }
        
        if not os.path.exists(safe_path):
            return {
                "success": False,
                "error": f"File not found: {file_path}"
            }
        
        with open(safe_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {
            "success": True,
            "content": content,
            "file_path": file_path
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def clear_virtual_fs() -> dict:
    """Clear the entire virtual file system."""
    import shutil
    try:
        if os.path.exists(VIRTUAL_FS_ROOT):
            shutil.rmtree(VIRTUAL_FS_ROOT)
        ensure_virtual_fs()
        return {"success": True, "message": "Virtual file system cleared"}
    except Exception as e:
        return {"success": False, "error": str(e)}


FILE_WRITE_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "file_write",
        "description": "Creates or writes to a file in the virtual file system. Use this tool when you need to create new files, write code, save content, or generate any file-based output. The file will be created at the specified path with the provided content.",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The path where the file should be created, including filename and extension. Example: /src/components/App.tsx, /package.json, /styles/main.css"
                },
                "operations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["write", "append"],
                                "description": "The type of operation: 'write' to overwrite/create, 'append' to add to existing"
                            },
                            "content": {
                                "type": "string",
                                "description": "The content to write to the file"
                            }
                        },
                        "required": ["type", "content"]
                    },
                    "description": "List of operations to perform on the file"
                }
            },
            "required": ["file_path", "operations"]
        }
    }
}