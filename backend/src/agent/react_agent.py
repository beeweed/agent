import json
import asyncio
import uuid
from typing import AsyncGenerator, Optional, Callable
from .models import ContextWindow, AgentState
from .system_prompt import get_system_prompt
from ..services.openrouter import chat_completion, chat_completion_non_streaming
from ..tools.file_write import file_write, FILE_WRITE_TOOL_DEFINITION


class ReActAgent:
    """
    ReAct (Reasoning + Acting) Agent implementation.
    
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
        max_iterations: int = 500
    ):
        self.api_key = api_key
        self.model = model
        self.max_iterations = max_iterations
        self.context = ContextWindow()
        self.current_iteration = 0
        self.is_running = False
        self.session_id = str(uuid.uuid4())
        
        self.tools = [FILE_WRITE_TOOL_DEFINITION]
        
        self.tool_executors = {
            "file_write": self._execute_file_write
        }
    
    def _execute_file_write(self, arguments: dict) -> dict:
        """Execute the file_write tool."""
        file_path = arguments.get("file_path", "")
        operations = arguments.get("operations", [])
        return file_write(file_path, operations)
    
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
        Run the ReAct agent loop.
        
        Args:
            user_message: The user's input message
            on_event: Optional callback for events
            
        Yields:
            Events from the agent execution
        """
        self.is_running = True
        self.current_iteration = 0
        
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
                
                response = await chat_completion_non_streaming(
                    api_key=self.api_key,
                    model=self.model,
                    messages=messages,
                    tools=self.tools
                )
                
                if not response.get("success"):
                    yield {
                        "type": "error",
                        "error": response.get("error", "Unknown error")
                    }
                    break
                
                data = response.get("data", {})
                choice = data.get("choices", [{}])[0]
                message = choice.get("message", {})
                finish_reason = choice.get("finish_reason", "")
                
                content = message.get("content", "")
                tool_calls = message.get("tool_calls", [])
                
                if content:
                    yield {
                        "type": "thought",
                        "content": content,
                        "iteration": self.current_iteration
                    }
                
                if tool_calls:
                    self.context.add_tool_call(tool_calls, content)
                    
                    for tool_call in tool_calls:
                        tool_name = tool_call.get("function", {}).get("name", "")
                        tool_id = tool_call.get("id", str(uuid.uuid4()))
                        
                        try:
                            arguments_str = tool_call.get("function", {}).get("arguments", "{}")
                            arguments = json.loads(arguments_str)
                        except json.JSONDecodeError:
                            arguments = {}
                        
                        yield {
                            "type": "tool_call",
                            "tool_name": tool_name,
                            "tool_id": tool_id,
                            "arguments": arguments,
                            "iteration": self.current_iteration
                        }
                        
                        if tool_name in self.tool_executors:
                            result = self.tool_executors[tool_name](arguments)
                            result_str = json.dumps(result)
                            
                            self.context.add_tool_result(tool_id, tool_name, result_str)
                            
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
                
                elif content and finish_reason == "stop":
                    self.context.add_assistant_message(content)
                    
                    yield {
                        "type": "complete",
                        "content": content,
                        "iteration": self.current_iteration,
                        "total_iterations": self.current_iteration
                    }
                    self.is_running = False
                    break
                
                elif not tool_calls and not content:
                    yield {
                        "type": "complete",
                        "content": "Task completed.",
                        "iteration": self.current_iteration,
                        "total_iterations": self.current_iteration
                    }
                    self.is_running = False
                    break
                
                await asyncio.sleep(0.1)
            
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
    
    def reset(self):
        """Reset the agent state."""
        self.context.clear()
        self.current_iteration = 0
        self.is_running = False
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