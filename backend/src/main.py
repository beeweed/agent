from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict
import json
import asyncio
import logging

from .agent.react_agent import ReActAgent
from .services.openrouter import fetch_models
from .services.e2b_sandbox import sandbox_manager
from .services.terminal_manager import terminal_manager

logger = logging.getLogger(__name__)

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
    e2b_api_key: Optional[str] = None
    e2b_template_id: Optional[str] = None


class ModelsRequest(BaseModel):
    api_key: str


class FileReadRequest(BaseModel):
    file_path: str


class SandboxRequest(BaseModel):
    e2b_api_key: str
    session_id: Optional[str] = "default"


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
    Requires E2B API key for sandbox operations.
    """
    session_id = request.session_id or "default"
    
    # Validate E2B API key
    if not request.e2b_api_key:
        async def error_generator():
            yield f"data: {json.dumps({'type': 'error', 'error': 'E2B API key is required. Please add it in Settings.'})}\n\n"
            yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"
        
        return StreamingResponse(
            error_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    if session_id not in agents:
        agents[session_id] = ReActAgent(
            api_key=request.api_key,
            model=request.model,
            max_iterations=500,
            e2b_api_key=request.e2b_api_key,
            session_id=session_id,  # Pass session_id for sandbox consistency
            e2b_template_id=request.e2b_template_id or ""
        )
    else:
        agents[session_id].api_key = request.api_key
        agents[session_id].model = request.model
        agents[session_id].e2b_api_key = request.e2b_api_key
        agents[session_id].session_id = session_id
        agents[session_id].e2b_template_id = request.e2b_template_id or ""
    
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
        await agents[session_id].reset()
    
    return {
        "success": True, 
        "message": "Agent reset and sandbox cleared"
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
                "files_created": 0,
                "files_in_context": [],
                "file_types": {}
            }
        }
    
    return agents[session_id].get_memory()


@app.get("/api/files")
async def get_files(session_id: str = "default"):
    """Get the file system tree from E2B sandbox."""
    return await sandbox_manager.list_files(session_id)


@app.post("/api/files/read")
async def read_file_content(request: FileReadRequest, session_id: str = "default"):
    """Read a file from the E2B sandbox."""
    result = await sandbox_manager.read_file(session_id, request.file_path)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result


@app.post("/api/files/refresh")
async def refresh_files(session_id: str = "default"):
    """Refresh the file tree from E2B sandbox."""
    return await sandbox_manager.list_files(session_id)


@app.post("/api/sandbox/create")
async def create_sandbox(request: SandboxRequest):
    """Create a new E2B sandbox for a session."""
    result = await sandbox_manager.create_sandbox(
        request.session_id or "default",
        request.e2b_api_key
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.get("/api/sandbox/status")
async def sandbox_status(session_id: str = "default"):
    """Get E2B sandbox status for a session."""
    status = await sandbox_manager.get_sandbox_status(session_id)
    return status


@app.post("/api/sandbox/kill")
async def kill_sandbox(session_id: str = "default"):
    """Kill E2B sandbox for a session - DISABLED."""
    return {"success": False, "error": "Sandbox deletion is not allowed"}


@app.post("/api/sandbox/keepalive")
async def sandbox_keepalive(request: SandboxRequest):
    """
    Keep sandbox alive by extending its timeout.
    
    This should be called periodically by the frontend (e.g., every 5 minutes)
    to prevent the sandbox from being automatically terminated by E2B.
    """
    result = await sandbox_manager.keepalive(
        request.session_id or "default",
        request.e2b_api_key
    )
    return result


@app.websocket("/ws/terminal/{session_id}")
async def terminal_websocket(websocket: WebSocket, session_id: str = "default"):
    """
    WebSocket endpoint for interactive PTY terminal (legacy single-terminal).
    
    Protocol:
      Client -> Server (JSON):
        { "type": "input", "data": "<base64-encoded-bytes>" }
        { "type": "resize", "cols": 80, "rows": 24 }
      
      Server -> Client (JSON):
        { "type": "output", "data": "<base64-encoded-bytes>" }
        { "type": "error", "message": "..." }
        { "type": "exit", "exit_code": 0 }
        { "type": "connected", "pid": 123 }
    """
    await websocket.accept()
    
    try:
        await terminal_manager.handle_websocket(websocket, session_id, sandbox_manager)
    except WebSocketDisconnect:
        logger.info(f"Terminal WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"Terminal WebSocket error for session {session_id}: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        await terminal_manager.cleanup_session(session_id)


@app.websocket("/ws/terminal/{session_id}/{terminal_id}")
async def terminal_websocket_multi(websocket: WebSocket, session_id: str, terminal_id: str):
    """
    WebSocket endpoint for multi-terminal support.
    
    Each terminal tab connects with a unique terminal_id.
    All terminals within the same session_id share the same E2B sandbox
    but get independent PTY processes.
    
    The composite key `{session_id}__term__{terminal_id}` is used internally
    to manage separate TerminalSession instances while the sandbox is looked up
    by the original session_id.
    """
    await websocket.accept()
    
    terminal_session_key = f"{session_id}__term__{terminal_id}"
    
    try:
        await terminal_manager.handle_websocket(
            websocket, terminal_session_key, sandbox_manager,
            sandbox_session_id=session_id
        )
    except WebSocketDisconnect:
        logger.info(f"Terminal WebSocket disconnected for {terminal_session_key}")
    except Exception as e:
        logger.error(f"Terminal WebSocket error for {terminal_session_key}: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        await terminal_manager.cleanup_session(terminal_session_key)


@app.post("/api/terminal/register")
async def register_terminal_session(request: dict):
    """
    Register a mapping from LLM session_name to a frontend terminal tab_id.
    Called by the frontend when it creates/reuses a terminal tab for the agent.
    """
    session_name = request.get("session_name", "")
    tab_id = request.get("tab_id", "")
    if not session_name or not tab_id:
        raise HTTPException(status_code=400, detail="session_name and tab_id are required")
    
    terminal_manager.register_session_name(session_name, tab_id)
    return {"success": True, "session_name": session_name, "tab_id": tab_id}


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
    sandbox_status = await sandbox_manager.get_sandbox_status(session_id)
    
    return {
        "session_id": agent.session_id,
        "is_running": agent.is_running,
        "current_iteration": agent.current_iteration,
        "max_iterations": agent.max_iterations,
        "status": "running" if agent.is_running else "idle",
        "sandbox": sandbox_status
    }