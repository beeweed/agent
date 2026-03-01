from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict
import json
import asyncio

from .agent.react_agent import ReActAgent
from .services.openrouter import fetch_models
from .services.e2b_sandbox import sandbox_manager

# Store active WebSocket connections for terminals
terminal_connections: Dict[str, Dict[str, WebSocket]] = {}  # session_id -> {terminal_id -> websocket}

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


class ModelsRequest(BaseModel):
    api_key: str


class FileReadRequest(BaseModel):
    file_path: str


class SandboxRequest(BaseModel):
    e2b_api_key: str
    session_id: Optional[str] = "default"


class TerminalCreateRequest(BaseModel):
    terminal_id: str
    cols: int = 80
    rows: int = 24
    e2b_api_key: str
    session_id: Optional[str] = "default"


class TerminalInputRequest(BaseModel):
    terminal_id: str
    data: str
    session_id: Optional[str] = "default"


class TerminalResizeRequest(BaseModel):
    terminal_id: str
    cols: int
    rows: int
    session_id: Optional[str] = "default"


class TerminalCloseRequest(BaseModel):
    terminal_id: str
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
            session_id=session_id  # Pass session_id for sandbox consistency
        )
    else:
        agents[session_id].api_key = request.api_key
        agents[session_id].model = request.model
        agents[session_id].e2b_api_key = request.e2b_api_key
        agents[session_id].session_id = session_id
    
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
    # Include sandbox_id for frontend terminal connection
    sandbox_info = sandbox_manager.sandbox_info.get(session_id, {})
    status["sandbox_id"] = sandbox_info.get("sandbox_id")
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


# ============================================================================
# TERMINAL ENDPOINTS
# ============================================================================

@app.post("/api/terminal/create")
async def create_terminal(request: TerminalCreateRequest):
    """Create a new PTY terminal in the E2B sandbox."""
    session_id = request.session_id or "default"
    
    # Ensure sandbox exists (create if needed using the provided API key)
    sandbox_status = await sandbox_manager.get_sandbox_status(session_id)
    if not sandbox_status.get("is_running"):
        # Create sandbox first
        result = await sandbox_manager.create_sandbox(session_id, request.e2b_api_key)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to create sandbox"))
    
    # Create terminal
    result = await sandbox_manager.create_terminal(
        session_id,
        request.terminal_id,
        request.cols,
        request.rows
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@app.post("/api/terminal/input")
async def send_terminal_input(request: TerminalInputRequest):
    """Send input to a terminal."""
    session_id = request.session_id or "default"
    
    result = await sandbox_manager.send_terminal_input(
        session_id,
        request.terminal_id,
        request.data
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@app.post("/api/terminal/resize")
async def resize_terminal(request: TerminalResizeRequest):
    """Resize a terminal."""
    session_id = request.session_id or "default"
    
    result = await sandbox_manager.resize_terminal(
        session_id,
        request.terminal_id,
        request.cols,
        request.rows
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@app.post("/api/terminal/close")
async def close_terminal(request: TerminalCloseRequest):
    """Close a terminal."""
    session_id = request.session_id or "default"
    
    result = await sandbox_manager.close_terminal(
        session_id,
        request.terminal_id
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@app.websocket("/ws/terminal/{session_id}/{terminal_id}")
async def terminal_websocket(websocket: WebSocket, session_id: str, terminal_id: str):
    """
    WebSocket endpoint for real-time terminal communication.
    
    Messages from client:
    - {"type": "input", "data": "..."} - Send input to terminal
    - {"type": "resize", "cols": N, "rows": N} - Resize terminal
    
    Messages to client:
    - {"type": "output", "data": "..."} - Terminal output
    - {"type": "error", "error": "..."} - Error message
    """
    await websocket.accept()
    
    # Store connection
    if session_id not in terminal_connections:
        terminal_connections[session_id] = {}
    terminal_connections[session_id][terminal_id] = websocket
    
    try:
        # Get terminal info
        terminal_info = sandbox_manager.get_terminal_info(session_id, terminal_id)
        if not terminal_info:
            await websocket.send_json({"type": "error", "error": "Terminal not found"})
            await websocket.close()
            return
        
        # Get sandbox
        sandbox = await sandbox_manager.get_sandbox(session_id)
        if not sandbox:
            await websocket.send_json({"type": "error", "error": "Sandbox not found"})
            await websocket.close()
            return
        
        # Set up output handler
        async def send_output(data: bytes):
            try:
                # Send as base64-encoded string for binary safety
                import base64
                await websocket.send_json({
                    "type": "output",
                    "data": base64.b64encode(data).decode('utf-8')
                })
            except Exception:
                pass
        
        # Subscribe to terminal output
        pty = terminal_info.get("pty")
        if pty:
            pty.on_data = send_output
        
        # Handle incoming messages
        while True:
            try:
                message = await websocket.receive_json()
                msg_type = message.get("type")
                
                if msg_type == "input":
                    data = message.get("data", "")
                    await sandbox_manager.send_terminal_input(session_id, terminal_id, data)
                
                elif msg_type == "resize":
                    cols = message.get("cols", 80)
                    rows = message.get("rows", 24)
                    await sandbox_manager.resize_terminal(session_id, terminal_id, cols, rows)
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                await websocket.send_json({"type": "error", "error": str(e)})
    
    finally:
        # Cleanup connection
        if session_id in terminal_connections:
            terminal_connections[session_id].pop(terminal_id, None)
            if not terminal_connections[session_id]:
                del terminal_connections[session_id]


@app.get("/api/terminal/list")
async def list_terminals(session_id: str = "default"):
    """List all terminals for a session."""
    terminals = sandbox_manager.get_all_terminals(session_id)
    return {
        "success": True,
        "terminals": [
            {
                "terminal_id": tid,
                "pid": info.get("pid"),
                "cols": info.get("cols"),
                "rows": info.get("rows")
            }
            for tid, info in terminals.items()
        ]
    }