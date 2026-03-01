"""
E2B Sandbox Service

Manages E2B sandbox instances for secure code execution and file operations.
Uses the base template for maximum flexibility.
"""

import asyncio
from typing import Optional, Dict, List, Any
from e2b import AsyncSandbox
from e2b.sandbox.filesystem.filesystem import FileType


# Maximum timeout: 24 hours for Pro users, 1 hour for Hobby users
MAX_TIMEOUT_SECONDS = 86400  # 24 hours
DEFAULT_TIMEOUT_SECONDS = 3600  # 1 hour (hobby plan safe default)


class E2BSandboxManager:
    """
    Manages E2B sandbox lifecycle and operations.
    
    Each session gets its own sandbox instance that persists
    until the session is reset or times out.
    
    Features:
    - Reconnects to existing sandboxes when possible
    - Stores sandbox IDs for reconnection after server restart
    - Extends sandbox timeout on activity
    - PTY terminal support for interactive shell access
    """
    
    def __init__(self):
        self.sandboxes: Dict[str, AsyncSandbox] = {}
        self.sandbox_info: Dict[str, dict] = {}
        self._api_keys: Dict[str, str] = {}  # Store API keys for reconnection
        self._terminals: Dict[str, Dict[str, Any]] = {}  # session_id -> {terminal_id -> terminal_info}
    
    async def create_sandbox(
        self,
        session_id: str,
        api_key: str,
        timeout: int = None
    ) -> dict:
        """
        Create a new E2B sandbox for a session or reconnect to existing one.
        
        Args:
            session_id: Unique session identifier
            api_key: E2B API key
            timeout: Sandbox timeout in seconds (default: 1 hour, max: 24 hours)
            
        Returns:
            Dictionary with sandbox creation result
        """
        # Use default timeout if not specified
        if timeout is None:
            timeout = DEFAULT_TIMEOUT_SECONDS
        
        # Store API key for reconnection
        self._api_keys[session_id] = api_key
        
        try:
            # Try to reuse existing sandbox object if present
            if session_id in self.sandboxes:
                existing_sandbox = self.sandboxes[session_id]
                try:
                    is_running = await existing_sandbox.is_running()
                    if is_running:
                        # Extend timeout to keep sandbox alive
                        await self._extend_timeout(session_id)
                        return {
                            "success": True,
                            "message": "Existing sandbox reused",
                            "sandbox_id": self.sandbox_info.get(session_id, {}).get("sandbox_id", "existing"),
                            "session_id": session_id
                        }
                except Exception:
                    # Sandbox object invalid, try to reconnect by ID
                    pass
            
            # Try to reconnect to existing sandbox by ID if we have it stored
            sandbox_id = self.sandbox_info.get(session_id, {}).get("sandbox_id")
            if sandbox_id:
                reconnected = await self._try_reconnect(session_id, sandbox_id, api_key)
                if reconnected:
                    return {
                        "success": True,
                        "message": "Reconnected to existing sandbox",
                        "sandbox_id": sandbox_id,
                        "session_id": session_id
                    }
            
            # Create new sandbox using base template with extended timeout
            sandbox = await AsyncSandbox.create(
                api_key=api_key,
                timeout=timeout
            )
            
            self.sandboxes[session_id] = sandbox
            
            # Get sandbox info
            info = await sandbox.get_info()
            sandbox_id = info.sandbox_id if hasattr(info, 'sandbox_id') else str(sandbox)
            self.sandbox_info[session_id] = {
                "sandbox_id": sandbox_id,
                "template": "base",
                "timeout": timeout,
                "status": "running"
            }
            
            # Create default working directory
            await sandbox.files.make_dir("/home/user/project")
            
            return {
                "success": True,
                "message": "Sandbox created successfully",
                "sandbox_id": sandbox_id,
                "session_id": session_id
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id
            }
    
    async def _try_reconnect(
        self,
        session_id: str,
        sandbox_id: str,
        api_key: str
    ) -> bool:
        """
        Try to reconnect to an existing sandbox by ID.
        
        Returns:
            True if reconnection successful, False otherwise
        """
        try:
            sandbox = await AsyncSandbox.connect(
                sandbox_id=sandbox_id,
                api_key=api_key
            )
            
            # Verify sandbox is actually running
            is_running = await sandbox.is_running()
            if is_running:
                self.sandboxes[session_id] = sandbox
                # Extend timeout after reconnection
                await self._extend_timeout(session_id)
                return True
            
            return False
        except Exception:
            # Reconnection failed, sandbox may have been terminated
            return False
    
    async def _extend_timeout(self, session_id: str) -> bool:
        """
        Extend sandbox timeout to keep it alive longer.
        
        Returns:
            True if timeout was extended, False otherwise
        """
        try:
            sandbox = self.sandboxes.get(session_id)
            if sandbox:
                # Extend timeout to maximum allowed
                await sandbox.set_timeout(DEFAULT_TIMEOUT_SECONDS)
                return True
            return False
        except Exception:
            return False
    
    async def get_sandbox(self, session_id: str) -> Optional[AsyncSandbox]:
        """
        Get sandbox instance for a session.
        
        Automatically tries to reconnect if the sandbox object is invalid
        but we have a stored sandbox_id.
        """
        sandbox = self.sandboxes.get(session_id)
        
        if sandbox:
            try:
                is_running = await sandbox.is_running()
                if is_running:
                    return sandbox
            except Exception:
                pass
        
        # Try to reconnect using stored sandbox_id and api_key
        sandbox_id = self.sandbox_info.get(session_id, {}).get("sandbox_id")
        api_key = self._api_keys.get(session_id)
        
        if sandbox_id and api_key:
            reconnected = await self._try_reconnect(session_id, sandbox_id, api_key)
            if reconnected:
                return self.sandboxes.get(session_id)
        
        return None
    
    async def keepalive(self, session_id: str, api_key: str = None) -> dict:
        """
        Keep sandbox alive by extending its timeout.
        
        This should be called periodically by the frontend to prevent
        sandbox from being automatically terminated.
        
        Args:
            session_id: Session identifier
            api_key: E2B API key (optional, uses stored key if not provided)
            
        Returns:
            Dictionary with keepalive result
        """
        try:
            # Update stored API key if provided
            if api_key:
                self._api_keys[session_id] = api_key
            
            sandbox = self.sandboxes.get(session_id)
            sandbox_id = self.sandbox_info.get(session_id, {}).get("sandbox_id")
            
            # Try to reconnect if we don't have a valid sandbox object
            if not sandbox and sandbox_id:
                stored_api_key = self._api_keys.get(session_id) or api_key
                if stored_api_key:
                    reconnected = await self._try_reconnect(session_id, sandbox_id, stored_api_key)
                    if reconnected:
                        sandbox = self.sandboxes.get(session_id)
            
            if not sandbox:
                return {
                    "success": False,
                    "error": "No sandbox found for session",
                    "session_id": session_id
                }
            
            # Check if sandbox is running
            is_running = await sandbox.is_running()
            if not is_running:
                return {
                    "success": False,
                    "error": "Sandbox is not running",
                    "session_id": session_id
                }
            
            # Extend timeout
            await sandbox.set_timeout(DEFAULT_TIMEOUT_SECONDS)
            
            return {
                "success": True,
                "message": f"Sandbox keepalive successful, timeout extended to {DEFAULT_TIMEOUT_SECONDS} seconds",
                "session_id": session_id,
                "sandbox_id": sandbox_id
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id
            }
    
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
        """Kill sandbox for a session - DISABLED."""
        # Sandbox deletion is disabled
        return {"success": False, "error": "Sandbox deletion is not allowed"}
    
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
                        
                        if entry.type == FileType.DIR:
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
    
    # ============================================================================
    # TERMINAL OPERATIONS
    # ============================================================================
    
    async def create_terminal(
        self,
        session_id: str,
        terminal_id: str,
        cols: int = 80,
        rows: int = 24
    ) -> dict:
        """
        Create a new PTY terminal in the sandbox.
        
        Args:
            session_id: Session identifier
            terminal_id: Unique terminal identifier
            cols: Terminal columns
            rows: Terminal rows
            
        Returns:
            Dictionary with terminal creation result including PID
        """
        try:
            sandbox = await self.get_sandbox(session_id)
            if not sandbox:
                return {
                    "success": False,
                    "error": "No sandbox found for session. Please ensure sandbox is created first."
                }
            
            # Initialize terminal storage for session if needed
            if session_id not in self._terminals:
                self._terminals[session_id] = {}
            
            # Create PTY terminal
            pty = await sandbox.pty.create(
                cols=cols,
                rows=rows,
                timeout=0  # No timeout - keep terminal alive
            )
            
            # Store terminal info
            self._terminals[session_id][terminal_id] = {
                "pid": pty.pid,
                "cols": cols,
                "rows": rows,
                "pty": pty
            }
            
            return {
                "success": True,
                "terminal_id": terminal_id,
                "pid": pty.pid,
                "cols": cols,
                "rows": rows
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_terminal_input(
        self,
        session_id: str,
        terminal_id: str,
        data: str
    ) -> dict:
        """
        Send input to a terminal.
        
        Args:
            session_id: Session identifier
            terminal_id: Terminal identifier
            data: Input data to send
            
        Returns:
            Dictionary with operation result
        """
        try:
            sandbox = await self.get_sandbox(session_id)
            if not sandbox:
                return {"success": False, "error": "No sandbox found"}
            
            terminal_info = self._terminals.get(session_id, {}).get(terminal_id)
            if not terminal_info:
                return {"success": False, "error": "Terminal not found"}
            
            # Send input to PTY
            await sandbox.pty.send_input(
                terminal_info["pid"],
                data.encode('utf-8')
            )
            
            return {"success": True}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def resize_terminal(
        self,
        session_id: str,
        terminal_id: str,
        cols: int,
        rows: int
    ) -> dict:
        """
        Resize a terminal.
        
        Args:
            session_id: Session identifier
            terminal_id: Terminal identifier
            cols: New column count
            rows: New row count
            
        Returns:
            Dictionary with operation result
        """
        try:
            sandbox = await self.get_sandbox(session_id)
            if not sandbox:
                return {"success": False, "error": "No sandbox found"}
            
            terminal_info = self._terminals.get(session_id, {}).get(terminal_id)
            if not terminal_info:
                return {"success": False, "error": "Terminal not found"}
            
            # Resize PTY
            await sandbox.pty.resize(
                terminal_info["pid"],
                cols=cols,
                rows=rows
            )
            
            # Update stored info
            terminal_info["cols"] = cols
            terminal_info["rows"] = rows
            
            return {"success": True, "cols": cols, "rows": rows}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def close_terminal(
        self,
        session_id: str,
        terminal_id: str
    ) -> dict:
        """
        Close a terminal.
        
        Args:
            session_id: Session identifier
            terminal_id: Terminal identifier
            
        Returns:
            Dictionary with operation result
        """
        try:
            sandbox = await self.get_sandbox(session_id)
            if not sandbox:
                return {"success": False, "error": "No sandbox found"}
            
            terminal_info = self._terminals.get(session_id, {}).get(terminal_id)
            if not terminal_info:
                return {"success": False, "error": "Terminal not found"}
            
            # Kill PTY process
            try:
                await sandbox.pty.kill(terminal_info["pid"])
            except Exception:
                pass  # Terminal may already be closed
            
            # Remove from storage
            del self._terminals[session_id][terminal_id]
            
            return {"success": True}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def get_terminal_info(
        self,
        session_id: str,
        terminal_id: str
    ) -> Optional[dict]:
        """Get terminal info."""
        return self._terminals.get(session_id, {}).get(terminal_id)
    
    def get_all_terminals(self, session_id: str) -> Dict[str, dict]:
        """Get all terminals for a session."""
        return self._terminals.get(session_id, {})


# Global sandbox manager instance
sandbox_manager = E2BSandboxManager()