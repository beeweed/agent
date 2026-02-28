"""
E2B Sandbox Service

Manages E2B sandbox instances for secure code execution and file operations.
Uses the base template for maximum flexibility.
"""

import asyncio
from typing import Optional, Dict, List, Any
from e2b import AsyncSandbox


class E2BSandboxManager:
    """
    Manages E2B sandbox lifecycle and operations.
    
    Each session gets its own sandbox instance that persists
    until the session is reset or times out.
    """
    
    def __init__(self):
        self.sandboxes: Dict[str, AsyncSandbox] = {}
        self.sandbox_info: Dict[str, dict] = {}
    
    async def create_sandbox(
        self,
        session_id: str,
        api_key: str,
        timeout: int = 300
    ) -> dict:
        """
        Create a new E2B sandbox for a session.
        
        Args:
            session_id: Unique session identifier
            api_key: E2B API key
            timeout: Sandbox timeout in seconds (default 5 minutes)
            
        Returns:
            Dictionary with sandbox creation result
        """
        try:
            # Kill existing sandbox if present
            if session_id in self.sandboxes:
                await self.kill_sandbox(session_id)
            
            # Create new sandbox using base template
            sandbox = await AsyncSandbox.create(
                api_key=api_key,
                timeout=timeout
            )
            
            self.sandboxes[session_id] = sandbox
            
            # Get sandbox info
            info = await sandbox.get_info()
            self.sandbox_info[session_id] = {
                "sandbox_id": info.sandbox_id if hasattr(info, 'sandbox_id') else str(sandbox),
                "template": "base",
                "timeout": timeout,
                "status": "running"
            }
            
            # Create default working directory
            await sandbox.files.make_dir("/home/user/project")
            
            return {
                "success": True,
                "message": "Sandbox created successfully",
                "sandbox_id": self.sandbox_info[session_id]["sandbox_id"],
                "session_id": session_id
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id
            }
    
    async def get_sandbox(self, session_id: str) -> Optional[AsyncSandbox]:
        """Get sandbox instance for a session."""
        return self.sandboxes.get(session_id)
    
    async def is_sandbox_running(self, session_id: str) -> bool:
        """Check if sandbox is running for a session."""
        sandbox = self.sandboxes.get(session_id)
        if sandbox:
            try:
                return await sandbox.is_running()
            except Exception:
                return False
        return False
    
    async def kill_sandbox(self, session_id: str) -> dict:
        """Kill sandbox for a session."""
        try:
            sandbox = self.sandboxes.get(session_id)
            if sandbox:
                await sandbox.kill()
                del self.sandboxes[session_id]
                if session_id in self.sandbox_info:
                    del self.sandbox_info[session_id]
                return {"success": True, "message": "Sandbox killed"}
            return {"success": False, "error": "No sandbox found for session"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def write_file(
        self,
        session_id: str,
        file_path: str,
        content: str
    ) -> dict:
        """
        Write a file to the sandbox.
        
        Args:
            session_id: Session identifier
            file_path: Path in sandbox (should start with /home/user/)
            content: File content to write
            
        Returns:
            Dictionary with operation result
        """
        try:
            sandbox = self.sandboxes.get(session_id)
            if not sandbox:
                return {
                    "success": False,
                    "error": "No sandbox found for session. Please ensure E2B API key is configured.",
                    "file_path": file_path
                }
            
            # Ensure path starts with /home/user/
            if not file_path.startswith("/home/user/"):
                file_path = f"/home/user/{file_path.lstrip('/')}"
            
            # Write file to sandbox
            await sandbox.files.write(file_path, content)
            
            return {
                "success": True,
                "message": f"Successfully created/wrote file at {file_path}",
                "file_path": file_path
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "file_path": file_path
            }
    
    async def read_file(
        self,
        session_id: str,
        file_path: str
    ) -> dict:
        """
        Read a file from the sandbox.
        
        Args:
            session_id: Session identifier
            file_path: Path in sandbox
            
        Returns:
            Dictionary with file content
        """
        try:
            sandbox = self.sandboxes.get(session_id)
            if not sandbox:
                return {
                    "success": False,
                    "error": "No sandbox found for session",
                    "file_path": file_path
                }
            
            # Ensure path starts with /home/user/
            if not file_path.startswith("/home/user/"):
                file_path = f"/home/user/{file_path.lstrip('/')}"
            
            # Check if file exists
            exists = await sandbox.files.exists(file_path)
            if not exists:
                return {
                    "success": False,
                    "error": f"File not found: {file_path}",
                    "file_path": file_path
                }
            
            # Read file content
            content = await sandbox.files.read(file_path, format="text")
            
            # Format with line numbers
            lines = content.split('\n')
            formatted_lines = [f"{i+1:6d}\t{line}" for i, line in enumerate(lines)]
            formatted_content = '\n'.join(formatted_lines)
            
            return {
                "success": True,
                "content": formatted_content,
                "file_path": file_path,
                "file_name": file_path.split('/')[-1],
                "total_lines": len(lines),
                "lines_read": len(lines)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "file_path": file_path
            }
    
    async def list_files(
        self,
        session_id: str,
        path: str = "/home/user"
    ) -> dict:
        """
        List files in sandbox directory.
        
        Args:
            session_id: Session identifier
            path: Directory path to list
            
        Returns:
            Dictionary with file tree structure
        """
        try:
            sandbox = self.sandboxes.get(session_id)
            if not sandbox:
                return {
                    "name": "project",
                    "type": "folder",
                    "path": "/",
                    "children": []
                }
            
            async def build_tree(dir_path: str, depth: int = 0) -> List[dict]:
                if depth > 5:  # Limit recursion depth
                    return []
                    
                items = []
                try:
                    entries = await sandbox.files.list(dir_path)
                    for entry in entries:
                        entry_path = f"{dir_path}/{entry.name}" if dir_path != "/" else f"/{entry.name}"
                        
                        # Skip hidden files and common non-essential directories
                        if entry.name.startswith('.'):
                            continue
                        
                        if entry.type == "dir":
                            children = await build_tree(entry_path, depth + 1)
                            items.append({
                                "name": entry.name,
                                "type": "folder",
                                "path": entry_path.replace("/home/user", ""),
                                "children": children
                            })
                        else:
                            items.append({
                                "name": entry.name,
                                "type": "file",
                                "path": entry_path.replace("/home/user", "")
                            })
                except Exception:
                    pass
                
                return sorted(items, key=lambda x: (x["type"] != "folder", x["name"].lower()))
            
            children = await build_tree(path)
            
            return {
                "name": "project",
                "type": "folder",
                "path": "/",
                "children": children
            }
            
        except Exception as e:
            return {
                "name": "project",
                "type": "folder",
                "path": "/",
                "children": [],
                "error": str(e)
            }
    
    async def run_command(
        self,
        session_id: str,
        command: str,
        cwd: str = "/home/user"
    ) -> dict:
        """
        Run a command in the sandbox.
        
        Args:
            session_id: Session identifier
            command: Command to execute
            cwd: Working directory
            
        Returns:
            Dictionary with command result
        """
        try:
            sandbox = self.sandboxes.get(session_id)
            if not sandbox:
                return {
                    "success": False,
                    "error": "No sandbox found for session"
                }
            
            result = await sandbox.commands.run(command, cwd=cwd, timeout=60)
            
            return {
                "success": True,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_sandbox_status(self, session_id: str) -> dict:
        """Get sandbox status for a session."""
        sandbox = self.sandboxes.get(session_id)
        if sandbox:
            try:
                is_running = await sandbox.is_running()
                return {
                    "exists": True,
                    "is_running": is_running,
                    "info": self.sandbox_info.get(session_id, {})
                }
            except Exception as e:
                return {
                    "exists": True,
                    "is_running": False,
                    "error": str(e)
                }
        return {
            "exists": False,
            "is_running": False
        }
    
    async def cleanup_all(self):
        """Cleanup all sandboxes."""
        for session_id in list(self.sandboxes.keys()):
            await self.kill_sandbox(session_id)


# Global sandbox manager instance
sandbox_manager = E2BSandboxManager()