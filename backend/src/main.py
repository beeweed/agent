from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import asyncio

from .agent.react_agent import ReActAgent
from .services.openrouter import fetch_models
from .tools.file_write import get_file_tree, read_file, clear_virtual_fs

app = FastAPI(title="Vibe Coder API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agents: dict[str, ReActAgent] = {}


class ChatRequest(BaseModel):
    message: str
    api_key: str
    model: str = "anthropic/claude-3.5-sonnet"
    session_id: Optional[str] = None


class ModelsRequest(BaseModel):
    api_key: str


class FileReadRequest(BaseModel):
    file_path: str


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/models")
async def get_models(request: ModelsRequest):
    """Fetch all available models from OpenRouter."""
    result = await fetch_models(request.api_key)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    Start a chat with the agent using SSE streaming.
    """
    session_id = request.session_id or "default"
    
    if session_id not in agents:
        agents[session_id] = ReActAgent(
            api_key=request.api_key,
            model=request.model,
            max_iterations=500
        )
    else:
        agents[session_id].api_key = request.api_key
        agents[session_id].model = request.model
    
    agent = agents[session_id]
    
    async def event_generator():
        try:
            async for event in agent.run(request.message):
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.01)
            
            yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/chat/stop")
async def stop_chat(session_id: str = "default"):
    """Stop the current agent execution."""
    if session_id in agents:
        agents[session_id].stop()
        return {"success": True, "message": "Agent stopped"}
    return {"success": False, "error": "Session not found"}


@app.post("/api/chat/reset")
async def reset_chat(session_id: str = "default"):
    """Reset the agent and clear context."""
    if session_id in agents:
        agents[session_id].reset()
    
    clear_result = clear_virtual_fs()
    
    return {
        "success": True, 
        "message": "Agent reset and files cleared",
        "files_cleared": clear_result.get("success", False)
    }


@app.get("/api/memory")
async def get_memory(session_id: str = "default"):
    """Get the agent's current memory/context."""
    if session_id not in agents:
        return {
            "session_id": session_id,
            "current_iteration": 0,
            "max_iterations": 500,
            "is_running": False,
            "messages": [],
            "stats": {
                "total_messages": 0,
                "tool_calls": 0,
                "files_created": 0
            }
        }
    
    return agents[session_id].get_memory()


@app.get("/api/files")
async def get_files():
    """Get the virtual file system tree."""
    return get_file_tree()


@app.post("/api/files/read")
async def read_file_content(request: FileReadRequest):
    """Read a file from the virtual file system."""
    result = read_file(request.file_path)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@app.post("/api/files/clear")
async def clear_files():
    """Clear the virtual file system."""
    result = clear_virtual_fs()
    return result


@app.get("/api/status")
async def get_status(session_id: str = "default"):
    """Get the current agent status."""
    if session_id not in agents:
        return {
            "session_id": session_id,
            "is_running": False,
            "current_iteration": 0,
            "max_iterations": 500,
            "status": "idle"
        }
    
    agent = agents[session_id]
    return {
        "session_id": agent.session_id,
        "is_running": agent.is_running,
        "current_iteration": agent.current_iteration,
        "max_iterations": agent.max_iterations,
        "status": "running" if agent.is_running else "idle"
    }