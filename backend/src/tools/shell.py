"""
Shell Tool for executing commands in persistent terminal sessions.

This tool provides real shell execution inside the E2B sandbox environment,
allowing the LLM to run commands in persistent, named terminal sessions.
"""

import asyncio
from typing import Dict, Any, Optional, Callable
from ..services.e2b_sandbox import sandbox_manager


# Tool definition following OpenAI function calling format
SHELL_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "shell",
        "description": """Execute a shell command inside a persistent named terminal session in the E2B sandbox.

This tool provides real shell execution with the following capabilities:
- Creates the session if it does not exist
- Reuses the session if it already exists
- Maintains session state (working directory, environment variables, running processes)
- Returns real stdout and stderr output
- Supports long-running commands with timeout

Use this tool when you need to:
- Run build commands (npm install, npm run build, etc.)
- Execute scripts
- Navigate directories
- Install packages
- Start/stop servers
- Run tests
- Any shell operation""",
        "parameters": {
            "type": "object",
            "properties": {
                "session_name": {
                    "type": "string",
                    "description": "Unique name of the terminal session. If the session does not exist, it will be created. Use consistent names like 'main', 'build', 'server' to maintain context across commands."
                },
                "command": {
                    "type": "string",
                    "description": "Shell command to execute inside the specified session. Commands are executed in bash."
                }
            },
            "required": ["session_name", "command"]
        }
    }
}


class ShellSessionManager:
    """
    Manages persistent shell sessions for command execution.
    
    Each session maintains its own state including:
    - Working directory
    - Environment variables
    - Process state
    """
    
    def __init__(self):
        # Map of session_id -> {sandbox_session_id -> terminal_id}
        self._sessions: Dict[str, Dict[str, str]] = {}
        # Map of session_id -> sandbox_session_id -> output buffer
        self._output_buffers: Dict[str, Dict[str, str]] = {}
        # Map of session_id -> sandbox_session_id -> completion event
        self._completion_events: Dict[str, Dict[str, asyncio.Event]] = {}
        # Map of session_id -> sandbox_session_id -> terminal PID
        self._terminal_pids: Dict[str, Dict[str, int]] = {}
    
    def _get_terminal_id(self, sandbox_session_id: str, session_name: str) -> str:
        """Generate a unique terminal ID for a shell session."""
        return f"shell-{session_name}"
    
    async def execute_command(
        self,
        sandbox_session_id: str,
        session_name: str,
        command: str,
        timeout: int = 120,
        on_output: Optional[Callable[[str], None]] = None
    ) -> Dict[str, Any]:
        """
        Execute a command in a persistent shell session.
        
        Args:
            sandbox_session_id: The E2B sandbox session ID
            session_name: Name of the shell session
            command: Command to execute
            timeout: Maximum time to wait for command completion
            on_output: Optional callback for real-time output
            
        Returns:
            Dictionary with command execution result
        """
        terminal_id = self._get_terminal_id(sandbox_session_id, session_name)
        
        # Initialize session tracking if needed
        if sandbox_session_id not in self._sessions:
            self._sessions[sandbox_session_id] = {}
            self._output_buffers[sandbox_session_id] = {}
            self._completion_events[sandbox_session_id] = {}
            self._terminal_pids[sandbox_session_id] = {}
        
        try:
            # Get or create the sandbox
            sandbox = await sandbox_manager.get_sandbox(sandbox_session_id)
            if not sandbox:
                return {
                    "success": False,
                    "error": "No sandbox found. Please ensure the sandbox is created first.",
                    "session_name": session_name
                }
            
            # Check if we need to create a new terminal session
            needs_new_terminal = terminal_id not in self._sessions[sandbox_session_id]
            
            if needs_new_terminal:
                # Create a new PTY terminal for this session
                pty = await sandbox.pty.create(
                    cols=120,
                    rows=30,
                    timeout=0  # No timeout - keep terminal alive
                )
                
                self._sessions[sandbox_session_id][terminal_id] = terminal_id
                self._terminal_pids[sandbox_session_id][terminal_id] = pty.pid
                self._output_buffers[sandbox_session_id][terminal_id] = ""
                
                # Wait for shell prompt
                await asyncio.sleep(0.5)
            
            pid = self._terminal_pids[sandbox_session_id].get(terminal_id)
            if not pid:
                return {
                    "success": False,
                    "error": "Terminal session not found",
                    "session_name": session_name
                }
            
            # Clear previous output buffer
            self._output_buffers[sandbox_session_id][terminal_id] = ""
            
            # Create completion event for this command
            completion_event = asyncio.Event()
            self._completion_events[sandbox_session_id][terminal_id] = completion_event
            
            # Send the command with newline
            command_with_newline = command + "\n"
            await sandbox.pty.send_input(pid, command_with_newline.encode('utf-8'))
            
            # Collect output with timeout
            output_collector = []
            prompt_patterns = [
                b'$ ',
                b'# ',
                b'> ',
                b'user@',
            ]
            
            start_time = asyncio.get_event_loop().time()
            last_output_time = start_time
            command_started = False
            
            while True:
                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed > timeout:
                    break
                
                # Check if we've received output recently
                time_since_last = asyncio.get_event_loop().time() - last_output_time
                
                # Wait for more output or timeout
                try:
                    await asyncio.sleep(0.1)
                except asyncio.CancelledError:
                    break
                
                # Get current buffer
                current_buffer = self._output_buffers[sandbox_session_id].get(terminal_id, "")
                
                if current_buffer:
                    # Check if command echo appeared
                    if command.strip() in current_buffer:
                        command_started = True
                    
                    # Check for prompt indicating command completion
                    buffer_bytes = current_buffer.encode('utf-8', errors='ignore')
                    has_prompt = any(pattern in buffer_bytes for pattern in prompt_patterns)
                    
                    # If we've seen the command and now see a prompt, command is done
                    if command_started and has_prompt and time_since_last > 0.5:
                        # Check if this is a new prompt after output
                        lines = current_buffer.strip().split('\n')
                        if len(lines) > 1:  # We have output beyond just the command
                            break
                
                # Update last output time if buffer changed
                if current_buffer != self._output_buffers[sandbox_session_id].get(terminal_id, ""):
                    last_output_time = asyncio.get_event_loop().time()
                    if on_output:
                        on_output(current_buffer)
            
            # Get final output
            final_output = self._output_buffers[sandbox_session_id].get(terminal_id, "")
            
            # Clean up output - remove command echo and trailing prompt
            output_lines = final_output.split('\n')
            cleaned_lines = []
            skip_first_prompt = True
            
            for line in output_lines:
                # Skip the command echo line
                if command.strip() in line and skip_first_prompt:
                    skip_first_prompt = False
                    continue
                # Skip empty lines at the start
                if not cleaned_lines and not line.strip():
                    continue
                cleaned_lines.append(line)
            
            # Remove trailing prompt line
            while cleaned_lines and any(
                p.decode('utf-8', errors='ignore').strip() in cleaned_lines[-1] 
                for p in prompt_patterns
            ):
                cleaned_lines.pop()
            
            cleaned_output = '\n'.join(cleaned_lines).strip()
            
            return {
                "success": True,
                "output": cleaned_output if cleaned_output else "(no output)",
                "session_name": session_name,
                "command": command
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "session_name": session_name,
                "command": command
            }
    
    def update_output(self, sandbox_session_id: str, terminal_id: str, data: bytes):
        """Update the output buffer for a terminal session."""
        if sandbox_session_id not in self._output_buffers:
            self._output_buffers[sandbox_session_id] = {}
        
        if terminal_id not in self._output_buffers[sandbox_session_id]:
            self._output_buffers[sandbox_session_id][terminal_id] = ""
        
        try:
            decoded = data.decode('utf-8', errors='replace')
            self._output_buffers[sandbox_session_id][terminal_id] += decoded
        except Exception:
            pass
    
    async def close_session(self, sandbox_session_id: str, session_name: str):
        """Close a shell session."""
        terminal_id = self._get_terminal_id(sandbox_session_id, session_name)
        
        if sandbox_session_id in self._terminal_pids:
            pid = self._terminal_pids[sandbox_session_id].get(terminal_id)
            if pid:
                try:
                    sandbox = await sandbox_manager.get_sandbox(sandbox_session_id)
                    if sandbox:
                        await sandbox.pty.kill(pid)
                except Exception:
                    pass
            
            self._terminal_pids[sandbox_session_id].pop(terminal_id, None)
            self._sessions.get(sandbox_session_id, {}).pop(terminal_id, None)
            self._output_buffers.get(sandbox_session_id, {}).pop(terminal_id, None)
            self._completion_events.get(sandbox_session_id, {}).pop(terminal_id, None)


# Global shell session manager instance
shell_session_manager = ShellSessionManager()


async def execute_shell_command(
    sandbox_session_id: str,
    session_name: str,
    command: str,
    timeout: int = 120
) -> Dict[str, Any]:
    """
    Execute a shell command in a persistent session.
    
    This is the main entry point for the shell tool.
    
    Args:
        sandbox_session_id: The E2B sandbox session ID
        session_name: Name of the shell session
        command: Command to execute
        timeout: Maximum time to wait
        
    Returns:
        Dictionary with execution result
    """
    return await shell_session_manager.execute_command(
        sandbox_session_id,
        session_name,
        command,
        timeout
    )