import json
import asyncio
import uuid
import re
from typing import AsyncGenerator, Optional, Callable
from .models import ContextWindow, AgentState
from .system_prompt import get_system_prompt
from ..services.openrouter import chat_completion, chat_completion_non_streaming
from ..services.e2b_sandbox import sandbox_manager


# Tool definitions for E2B sandbox operations
FILE_WRITE_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "file_write",
        "description": "Creates or writes to a file in the E2B sandbox environment. Use this tool when you need to create new files, write code, save content, or generate any file-based output. The file will be created at the specified path with the provided content. IMPORTANT: All file paths MUST start with /home/user/",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "The path where the file should be created, including filename and extension. MUST start with /home/user/. Example: /home/user/project/src/App.tsx, /home/user/project/package.json"
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

FILE_READ_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "Read",
        "description": """Reads and returns the content of a specified file from the E2B sandbox. Supports text files.

Usage:
- file_path must start with /home/user/
- Returns formatted content with line numbers (cat -n format)
- Use this tool when you need to read existing files

Use this tool when you need to:
- Read existing files to understand their content
- Check the current state of a file before making changes
- Analyze code or configuration files
- Review file contents for debugging""",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path of the file to read. MUST start with /home/user/. Example: /home/user/project/src/main.py"
                }
            },
            "required": ["file_path"]
        }
    }
}


class StreamingToolParser:
    """Parser for streaming tool call arguments from LLM chunks."""
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.tool_calls = {}
        self.current_content = ""
        self.finished = False
    
    def process_chunk(self, chunk: dict) -> dict:
        """
        Process a streaming chunk and extract tool calls or content.
        
        Returns a dict with:
        - content_delta: New content text
        - tool_updates: Dict of tool_id -> {name, arguments_delta, arguments_so_far}
        - finish_reason: The finish reason if present
        """
        result = {
            "content_delta": "",
            "tool_updates": {},
            "finish_reason": None
        }
        
        choices = chunk.get("choices", [])
        if not choices:
            return result
        
        choice = choices[0]
        delta = choice.get("delta", {})
        result["finish_reason"] = choice.get("finish_reason")
        
        if "content" in delta and delta["content"]:
            result["content_delta"] = delta["content"]
            self.current_content += delta["content"]
        
        tool_calls = delta.get("tool_calls", [])
        for tc in tool_calls:
            index = tc.get("index", 0)
            tool_id = tc.get("id")
            
            if index not in self.tool_calls:
                self.tool_calls[index] = {
                    "id": tool_id or f"call_{index}",
                    "name": "",
                    "arguments": ""
                }
            
            if tool_id:
                self.tool_calls[index]["id"] = tool_id
            
            function = tc.get("function", {})
            if "name" in function:
                self.tool_calls[index]["name"] = function["name"]
            
            if "arguments" in function:
                arguments_delta = function["arguments"]
                self.tool_calls[index]["arguments"] += arguments_delta
                
                result["tool_updates"][index] = {
                    "id": self.tool_calls[index]["id"],
                    "name": self.tool_calls[index]["name"],
                    "arguments_delta": arguments_delta,
                    "arguments_so_far": self.tool_calls[index]["arguments"]
                }
        
        return result
    
    def get_parsed_tool_calls(self) -> list:
        """Get fully parsed tool calls with parsed JSON arguments."""
        parsed = []
        for index in sorted(self.tool_calls.keys()):
            tc = self.tool_calls[index]
            try:
                arguments = json.loads(tc["arguments"])
            except json.JSONDecodeError:
                arguments = {}
            
            parsed.append({
                "id": tc["id"],
                "function": {
                    "name": tc["name"],
                    "arguments": tc["arguments"]
                },
                "parsed_arguments": arguments
            })
        return parsed


class ContentStreamExtractor:
    """Extract content field from streaming JSON arguments."""
    
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.buffer = ""
        self.in_content = False
        self.content_extracted = ""
        self.escape_next = False
        self.file_path = ""
        self.file_path_extracted = False
    
    def extract_file_path(self, json_str: str) -> str:
        """Try to extract file_path from partial JSON."""
        match = re.search(r'"file_path"\s*:\s*"([^"]*)"', json_str)
        if match:
            return match.group(1)
        return ""
    
    def process_delta(self, arguments_so_far: str) -> tuple[str, str]:
        """
        Process the arguments JSON string and extract new content.
        Returns (new_content_delta, file_path).
        """
        if not self.file_path_extracted:
            self.file_path = self.extract_file_path(arguments_so_far)
            if self.file_path:
                self.file_path_extracted = True
        
        content_match = re.search(r'"content"\s*:\s*"', arguments_so_far)
        if not content_match:
            return "", self.file_path
        
        start_idx = content_match.end()
        
        new_content = ""
        i = start_idx + len(self.content_extracted)
        
        while i < len(arguments_so_far):
            char = arguments_so_far[i]
            
            if self.escape_next:
                if char == 'n':
                    new_content += '\n'
                elif char == 't':
                    new_content += '\t'
                elif char == 'r':
                    new_content += '\r'
                elif char == '\\':
                    new_content += '\\'
                elif char == '"':
                    new_content += '"'
                elif char == '/':
                    new_content += '/'
                else:
                    new_content += char
                self.escape_next = False
            elif char == '\\':
                self.escape_next = True
            elif char == '"':
                break
            else:
                new_content += char
            
            i += 1
        
        self.content_extracted += new_content
        return new_content, self.file_path


class ReActAgent:
    """
    ReAct (Reasoning + Acting) Agent implementation with E2B sandbox integration.
    
    The agent follows the ReAct pattern:
    1. Thought: Reason about the current state and plan next action
    2. Action: Execute a tool based on reasoning
    3. Observation: Process tool output
    4. Repeat: Continue until goal is achieved or max iterations reached
    """
    
    def __init__(
        self,
        api_key: str,
        model: str = "anthropic/claude-3.5-sonnet",
        max_iterations: int = 500,
        e2b_api_key: str = ""
    ):
        self.api_key = api_key
        self.model = model
        self.max_iterations = max_iterations
        self.e2b_api_key = e2b_api_key
        self.context = ContextWindow()
        self.current_iteration = 0
        self.is_running = False
        self.session_id = str(uuid.uuid4())
        self.sandbox_ready = False
        
        self.tools = [FILE_WRITE_TOOL_DEFINITION, FILE_READ_TOOL_DEFINITION]
        
        self.tool_executors = {
            "file_write": self._execute_file_write,
            "Read": self._execute_file_read
        }
    
    async def _execute_file_write(self, arguments: dict) -> dict:
        """Execute the file_write tool using E2B sandbox."""
        file_path = arguments.get("file_path", "")
        operations = arguments.get("operations", [])
        
        # Ensure path starts with /home/user/
        if not file_path.startswith("/home/user/"):
            file_path = f"/home/user/{file_path.lstrip('/')}"
        
        # Combine all write operations
        content = ""
        for operation in operations:
            op_type = operation.get("type", "write")
            op_content = operation.get("content", "")
            
            if op_type == "write":
                content = op_content
            elif op_type == "append":
                content += op_content
        
        # Write to E2B sandbox
        result = await sandbox_manager.write_file(
            self.session_id,
            file_path,
            content
        )
        
        return result
    
    async def _execute_file_read(self, arguments: dict) -> dict:
        """Execute the Read tool using E2B sandbox."""
        file_path = arguments.get("file_path", "")
        
        # Ensure path starts with /home/user/
        if not file_path.startswith("/home/user/"):
            file_path = f"/home/user/{file_path.lstrip('/')}"
        
        result = await sandbox_manager.read_file(
            self.session_id,
            file_path
        )
        
        return result
    
    async def ensure_sandbox(self) -> dict:
        """Ensure sandbox is created and running."""
        if not self.e2b_api_key:
            return {
                "success": False,
                "error": "E2B API key not configured"
            }
        
        # Check if sandbox already exists and is running
        status = await sandbox_manager.get_sandbox_status(self.session_id)
        if status.get("exists") and status.get("is_running"):
            self.sandbox_ready = True
            return {"success": True, "message": "Sandbox already running"}
        
        # Create new sandbox
        result = await sandbox_manager.create_sandbox(
            self.session_id,
            self.e2b_api_key,
            timeout=300  # 5 minutes
        )
        
        if result.get("success"):
            self.sandbox_ready = True
        
        return result
    
    def _get_messages(self) -> list:
        """Get messages for the LLM including system prompt."""
        messages = [
            {"role": "system", "content": get_system_prompt()}
        ]
        messages.extend(self.context.get_messages())
        return messages
    
    async def run(
        self,
        user_message: str,
        on_event: Optional[Callable] = None
    ) -> AsyncGenerator:
        """
        Run the ReAct agent loop with real-time streaming.
        
        Args:
            user_message: The user's input message
            on_event: Optional callback for events
            
        Yields:
            Events from the agent execution including real-time code streaming
        """
        self.is_running = True
        self.current_iteration = 0
        
        # Emit sandbox creation event
        yield {
            "type": "sandbox_creating",
            "message": "Creating sandbox..."
        }
        
        # Ensure sandbox is ready
        sandbox_result = await self.ensure_sandbox()
        if not sandbox_result.get("success"):
            yield {
                "type": "sandbox_error",
                "error": sandbox_result.get("error", "Failed to create sandbox")
            }
            self.is_running = False
            return
        
        yield {
            "type": "sandbox_ready",
            "message": "Sandbox ready"
        }
        
        self.context.add_user_message(user_message)
        
        yield {
            "type": "iteration_start",
            "iteration": self.current_iteration,
            "max_iterations": self.max_iterations
        }
        
        try:
            while self.is_running and self.current_iteration < self.max_iterations:
                self.current_iteration += 1
                
                yield {
                    "type": "iteration",
                    "iteration": self.current_iteration,
                    "max_iterations": self.max_iterations
                }
                
                messages = self._get_messages()
                
                stream_parser = StreamingToolParser()
                content_extractors = {}
                accumulated_content = ""
                has_tool_calls = False
                finish_reason = None
                streaming_started = {}
                thought_stream_started = False
                
                async for chunk_event in chat_completion(
                    api_key=self.api_key,
                    model=self.model,
                    messages=messages,
                    tools=self.tools,
                    stream=True
                ):
                    if chunk_event.get("type") == "error":
                        yield {
                            "type": "error",
                            "error": chunk_event.get("error", "Unknown error")
                        }
                        self.is_running = False
                        return
                    
                    if chunk_event.get("type") == "done":
                        break
                    
                    if chunk_event.get("type") != "chunk":
                        continue
                    
                    chunk_data = chunk_event.get("data", {})
                    parsed = stream_parser.process_chunk(chunk_data)
                    
                    if parsed["content_delta"]:
                        accumulated_content += parsed["content_delta"]
                        
                        if not thought_stream_started:
                            thought_stream_started = True
                            yield {
                                "type": "thought_stream_start",
                                "iteration": self.current_iteration
                            }
                        
                        yield {
                            "type": "thought_stream_chunk",
                            "chunk": parsed["content_delta"],
                            "iteration": self.current_iteration
                        }
                    
                    if parsed["finish_reason"]:
                        finish_reason = parsed["finish_reason"]
                    
                    for index, update in parsed["tool_updates"].items():
                        has_tool_calls = True
                        tool_name = update["name"]
                        
                        if tool_name == "file_write":
                            if index not in content_extractors:
                                content_extractors[index] = ContentStreamExtractor()
                            
                            extractor = content_extractors[index]
                            content_delta, file_path = extractor.process_delta(
                                update["arguments_so_far"]
                            )
                            
                            if file_path and index not in streaming_started:
                                streaming_started[index] = True
                                print(f"[CODE_STREAM_START] {file_path}")
                                yield {
                                    "type": "code_stream_start",
                                    "tool_id": update["id"],
                                    "tool_name": tool_name,
                                    "file_path": file_path,
                                    "iteration": self.current_iteration
                                }
                            
                            if content_delta:
                                print(f"[CODE_STREAM_CHUNK] {len(content_delta)} chars: {content_delta[:30]}...")
                                yield {
                                    "type": "code_stream_chunk",
                                    "tool_id": update["id"],
                                    "chunk": content_delta,
                                    "file_path": file_path,
                                    "iteration": self.current_iteration
                                }
                
                if thought_stream_started:
                    yield {
                        "type": "thought_stream_end",
                        "content": accumulated_content,
                        "iteration": self.current_iteration
                    }
                elif accumulated_content:
                    yield {
                        "type": "thought",
                        "content": accumulated_content,
                        "iteration": self.current_iteration
                    }
                
                if has_tool_calls:
                    tool_calls = stream_parser.get_parsed_tool_calls()
                    
                    formatted_tool_calls = []
                    for tc in tool_calls:
                        formatted_tool_calls.append({
                            "id": tc["id"],
                            "function": tc["function"],
                            "type": "function"
                        })
                    
                    self.context.add_tool_call(formatted_tool_calls, accumulated_content)
                    
                    for i, tc in enumerate(tool_calls):
                        tool_name = tc["function"]["name"]
                        tool_id = tc["id"]
                        arguments = tc["parsed_arguments"]
                        
                        if i in streaming_started:
                            yield {
                                "type": "code_stream_end",
                                "tool_id": tool_id,
                                "tool_name": tool_name,
                                "file_path": arguments.get("file_path", ""),
                                "iteration": self.current_iteration
                            }
                        
                        yield {
                            "type": "tool_call",
                            "tool_name": tool_name,
                            "tool_id": tool_id,
                            "arguments": arguments,
                            "iteration": self.current_iteration
                        }
                        
                        if tool_name in self.tool_executors:
                            # Emit read_file_start event before executing Read tool
                            if tool_name == "Read":
                                file_path = arguments.get("file_path", "")
                                yield {
                                    "type": "read_file_start",
                                    "tool_id": tool_id,
                                    "tool_name": tool_name,
                                    "file_path": file_path,
                                    "iteration": self.current_iteration
                                }
                            
                            result = await self.tool_executors[tool_name](arguments)
                            result_str = json.dumps(result)
                            
                            self.context.add_tool_result(tool_id, tool_name, result_str)
                            
                            # Emit read_file_end event with content for Read tool
                            if tool_name == "Read":
                                yield {
                                    "type": "read_file_end",
                                    "tool_id": tool_id,
                                    "tool_name": tool_name,
                                    "file_path": arguments.get("file_path", ""),
                                    "result": result,
                                    "iteration": self.current_iteration
                                }
                            
                            yield {
                                "type": "tool_result",
                                "tool_name": tool_name,
                                "tool_id": tool_id,
                                "result": result,
                                "iteration": self.current_iteration
                            }
                        else:
                            error_result = {
                                "success": False,
                                "error": f"Unknown tool: {tool_name}"
                            }
                            self.context.add_tool_result(
                                tool_id, 
                                tool_name, 
                                json.dumps(error_result)
                            )
                            
                            yield {
                                "type": "tool_error",
                                "tool_name": tool_name,
                                "error": f"Unknown tool: {tool_name}",
                                "iteration": self.current_iteration
                            }
                
                elif accumulated_content and finish_reason == "stop":
                    self.context.add_assistant_message(accumulated_content)
                    
                    yield {
                        "type": "complete",
                        "content": accumulated_content,
                        "iteration": self.current_iteration,
                        "total_iterations": self.current_iteration
                    }
                    self.is_running = False
                    break
                
                elif not has_tool_calls and not accumulated_content:
                    yield {
                        "type": "complete",
                        "content": "Task completed.",
                        "iteration": self.current_iteration,
                        "total_iterations": self.current_iteration
                    }
                    self.is_running = False
                    break
                
                await asyncio.sleep(0.05)
            
            if self.current_iteration >= self.max_iterations:
                yield {
                    "type": "max_iterations_reached",
                    "iteration": self.current_iteration,
                    "max_iterations": self.max_iterations,
                    "message": "Maximum iterations reached. Stopping agent."
                }
                
        except Exception as e:
            yield {
                "type": "error",
                "error": str(e),
                "iteration": self.current_iteration
            }
        finally:
            self.is_running = False
    
    def stop(self):
        """Stop the agent execution."""
        self.is_running = False
    
    async def reset(self):
        """Reset the agent state and kill sandbox."""
        self.context.clear()
        self.current_iteration = 0
        self.is_running = False
        self.sandbox_ready = False
        
        # Kill the sandbox
        await sandbox_manager.kill_sandbox(self.session_id)
        
        # Generate new session ID
        self.session_id = str(uuid.uuid4())
    
    def get_memory(self) -> dict:
        """Get the agent's memory/context."""
        stats = self.context.get_stats()
        return {
            "session_id": self.session_id,
            "current_iteration": self.current_iteration,
            "max_iterations": self.max_iterations,
            "is_running": self.is_running,
            "messages": self.context.get_messages(),
            "stats": stats
        }