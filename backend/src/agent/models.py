from pydantic import BaseModel
from typing import Optional, Any
import uuid


class UserMessage(BaseModel):
    content: str
    role: str = "user"


class AssistantMessage(BaseModel):
    content: str
    role: str = "assistant"


class ToolUse(BaseModel):
    type: str = "tool_use"
    id: str
    name: str
    input: dict


class ToolUseMessage(BaseModel):
    role: str = "assistant"
    content: Optional[str] = None
    tool_calls: list[dict] = []


class ToolResult(BaseModel):
    type: str = "tool_result"
    tool_use_id: str
    content: str
    is_error: bool = False


class ToolResultMessage(BaseModel):
    role: str = "tool"
    tool_call_id: str
    name: str
    content: str


class ThoughtMessage(BaseModel):
    role: str = "assistant"
    content: str
    thought_type: str = "reasoning"


class ContextWindow(BaseModel):
    conversation_history: list = []
    
    def add(self, message: dict):
        """Add a message to the conversation history."""
        self.conversation_history.append(message)
    
    def add_user_message(self, content: str):
        """Add a user message."""
        self.conversation_history.append({
            "role": "user",
            "content": content
        })
    
    def add_assistant_message(self, content: str):
        """Add an assistant message."""
        self.conversation_history.append({
            "role": "assistant", 
            "content": content
        })
    
    def add_tool_call(self, tool_calls: list, content: Optional[str] = None):
        """Add a tool call message from assistant."""
        msg = {
            "role": "assistant",
            "content": content,
            "tool_calls": tool_calls
        }
        self.conversation_history.append(msg)
    
    def add_tool_result(self, tool_call_id: str, name: str, content: str):
        """Add a tool result message."""
        self.conversation_history.append({
            "role": "tool",
            "tool_call_id": tool_call_id,
            "name": name,
            "content": content
        })
    
    def get_messages(self) -> list:
        """Get all messages in the context window."""
        return self.conversation_history
    
    def clear(self):
        """Clear the conversation history."""
        self.conversation_history = []
    
    def get_stats(self) -> dict:
        """Get statistics about the context window."""
        import json
        import os
        
        tool_calls = 0
        files_created = 0
        files_in_context: list[dict] = []
        file_types: dict[str, int] = {}
        
        for msg in self.conversation_history:
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                tool_calls += len(msg.get("tool_calls", []))
            if msg.get("role") == "tool" and msg.get("name") == "file_write":
                try:
                    result = json.loads(msg.get("content", "{}"))
                    if result.get("success"):
                        files_created += 1
                        file_path = result.get("file_path", "")
                        if file_path:
                            _, ext = os.path.splitext(file_path)
                            ext = ext.lower() if ext else "no_extension"
                            file_type = self._get_file_type_category(ext)
                            
                            file_types[file_type] = file_types.get(file_type, 0) + 1
                            
                            files_in_context.append({
                                "path": file_path,
                                "name": os.path.basename(file_path),
                                "extension": ext,
                                "type": file_type
                            })
                except:
                    pass
        
        return {
            "total_messages": len(self.conversation_history),
            "tool_calls": tool_calls,
            "files_created": files_created,
            "files_in_context": files_in_context,
            "file_types": file_types
        }
    
    def _get_file_type_category(self, ext: str) -> str:
        """Categorize file extension into a type category."""
        type_mapping = {
            ".py": "python",
            ".js": "javascript",
            ".jsx": "javascript",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".html": "html",
            ".htm": "html",
            ".css": "css",
            ".scss": "css",
            ".sass": "css",
            ".less": "css",
            ".json": "json",
            ".yaml": "config",
            ".yml": "config",
            ".toml": "config",
            ".ini": "config",
            ".env": "config",
            ".md": "markdown",
            ".mdx": "markdown",
            ".txt": "text",
            ".sql": "database",
            ".sh": "shell",
            ".bash": "shell",
            ".zsh": "shell",
            ".rs": "rust",
            ".go": "go",
            ".java": "java",
            ".kt": "kotlin",
            ".swift": "swift",
            ".c": "c",
            ".cpp": "cpp",
            ".h": "c",
            ".hpp": "cpp",
            ".rb": "ruby",
            ".php": "php",
            ".vue": "vue",
            ".svelte": "svelte",
            ".astro": "astro",
            ".svg": "image",
            ".png": "image",
            ".jpg": "image",
            ".jpeg": "image",
            ".gif": "image",
            ".webp": "image",
            ".ico": "image",
            "no_extension": "other"
        }
        return type_mapping.get(ext, "other")


class AgentState(BaseModel):
    session_id: str
    context: ContextWindow = ContextWindow()
    current_iteration: int = 0
    max_iterations: int = 500
    is_running: bool = False
    status: str = "idle"
    
    class Config:
        arbitrary_types_allowed = True