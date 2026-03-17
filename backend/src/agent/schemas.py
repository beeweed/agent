from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class AgentEventType(str, Enum):
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    TEXT_DELTA = "text_delta"
    TEXT_COMPLETE = "text_complete"
    ITERATION = "iteration"
    ERROR = "error"
    DONE = "done"
    STATUS = "status"


class AgentEvent(BaseModel):
    type: AgentEventType
    content: str = ""
    tool_name: str = ""
    tool_args: dict = {}
    tool_result: str = ""
    iteration: int = 0
    is_error: bool = False
    file_path: str = ""


class AgentInput(BaseModel):
    message: str = Field(..., min_length=1, description="User message/goal for the agent")
    model: str = Field(default="anthropic/claude-sonnet-4", description="OpenRouter model identifier")
    api_key: str = Field(..., min_length=1, description="OpenRouter API key")
    max_iterations: int = Field(default=5000, ge=1, le=5000)


class AgentState(BaseModel):
    session_id: str
    iteration: int = 0
    max_iterations: int = 5000
    is_running: bool = False
    goal: str = ""
    steps: list[dict] = []


class FileWriteArgs(BaseModel):
    file_path: str = Field(..., description="Path of the file to write, relative to workspace root")
    content: str = Field(..., description="Content to write to the file")