# Vibe Coder

An autonomous AI-powered coding agent that builds full-stack applications inside a secure cloud sandbox. Chat with an LLM, watch it write code, run commands, and preview results — all in your browser.

## Overview

Vibe Coder pairs a **ReAct (Reasoning + Acting) agent** with an [E2B](https://e2b.dev) cloud sandbox. You describe what you want to build in natural language, and the agent plans, writes files, installs dependencies, starts dev servers, and iterates — streaming every step back to a real-time UI.

### Key Features

- **Conversational coding** — describe features, report bugs, or ask for refactors in plain English.
- **Sandboxed execution** — all code runs inside an isolated E2B sandbox; nothing touches your local machine.
- **Multi-model support** — connect any model available on [OpenRouter](https://openrouter.ai) (Claude, GPT-4o, Gemini, Llama, etc.).
- **Live terminal** — multiple interactive terminal tabs with full PTY support via WebSocket.
- **File explorer** — browse, read, and edit the sandbox filesystem in real time.
- **Live preview** — view the running application directly in the browser.
- **Streaming UI** — tool calls, file diffs, shell output, and thinking indicators stream as they happen.
- **Memory / context panel** — inspect the agent's message history, iteration count, and file context.

## Architecture

```
Frontend (React + Vite)          Backend (FastAPI)
========================         ========================
 Chat UI / File Tree   ------>   /api/chat   (SSE stream)
 Terminal (xterm.js)   <-WS-->   /ws/terminal (WebSocket)
 Live Preview iframe             /api/files, /api/sandbox
                                       |
                                  ReAct Agent
                                  (tool schemas)
                                       |
                                 +-----+------+
                                 |            |
                            OpenRouter    E2B Sandbox
                            (LLM API)    (code exec)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, shadcn/ui, Zustand, xterm.js |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic |
| LLM Gateway | OpenRouter API (native function calling) |
| Sandbox | E2B (cloud-hosted secure containers) |
| Deployment | Docker (multi-stage build) |

## Project Structure

```
agent/
├── backend/
│   ├── src/
│   │   ├── main.py                 # FastAPI app, routes, WebSocket endpoints
│   │   ├── agent/
│   │   │   ├── react_agent.py      # ReAct loop with streaming tool parser
│   │   │   ├── system_prompt.py    # Agent persona & rules
│   │   │   ├── tool_schemas.py     # Native function-calling tool definitions
│   │   │   ├── tool_executor.py    # Dispatches tool calls to E2B sandbox
│   │   │   └── models.py          # Context window / message models
│   │   └── services/
│   │       ├── openrouter.py       # LLM streaming client
│   │       ├── e2b_sandbox.py      # Sandbox lifecycle management
│   │       └── terminal_manager.py # PTY WebSocket bridge
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Root layout, mobile tabs, keepalive
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx       # Conversation UI
│   │   │   ├── ChatMessage.tsx     # Single message renderer
│   │   │   ├── MessageContent.tsx  # Markdown / code block rendering
│   │   │   ├── ComputerPanel.tsx   # Live preview + code editor
│   │   │   ├── FilePanel.tsx       # File explorer sidebar
│   │   │   ├── FileTree.tsx        # Recursive file tree
│   │   │   ├── MultiTerminal.tsx   # Tabbed terminal manager
│   │   │   ├── TerminalInstance.tsx # Single xterm.js terminal
│   │   │   ├── Terminal.tsx        # Legacy single-terminal wrapper
│   │   │   ├── ModelSelector.tsx   # LLM model picker
│   │   │   ├── SettingsDialog.tsx  # API keys & preferences
│   │   │   ├── MemorySidebar.tsx   # Agent memory inspector
│   │   │   ├── CodeEditor.tsx      # In-browser code viewer
│   │   │   ├── ThinkingIndicator.tsx
│   │   │   └── SandboxCreatorDialog.tsx
│   │   ├── hooks/
│   │   │   └── useApi.ts          # API client (SSE, REST, WebSocket)
│   │   ├── store/
│   │   │   ├── useStore.ts        # Global app state (Zustand)
│   │   │   └── useTerminalStore.ts # Terminal tab state
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── .env.example
├── virtual_fs/                    # Local virtual filesystem (dev)
├── Dockerfile                     # Production multi-stage build
├── Dockerfile.base                # Pre-built base image
└── package.json                   # Root scripts (dev / build / lint)
```

## Prerequisites

- **Node.js 20+** and **Bun** (frontend)
- **Python 3.10+** (backend)
- An **OpenRouter API key** — [get one here](https://openrouter.ai/keys)
- An **E2B API key** — [get one here](https://e2b.dev)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/beeweed/agent.git
cd agent
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env — defaults are fine for local dev

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env — set VITE_API_BASE_URL to your backend URL
```

**`backend/.env`**

| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Bind address | `0.0.0.0` |
| `PORT` | Server port | `8000` |
| `OPENROUTER_API_URL` | OpenRouter base URL | `https://openrouter.ai/api/v1` |
| `ALLOWED_ORIGINS` | CORS origins | `*` |
| `VIRTUAL_FS_PATH` | Local virtual FS path | `../virtual_fs` |
| `DEBUG` | Debug mode | `true` |

**`frontend/.env`**

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8000` |
| `VITE_APP_TITLE` | Browser tab title | `Vibe Coder` |
| `VITE_DEFAULT_MODEL` | Default LLM model | `anthropic/claude-3.5-sonnet` |

### 3. Install dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
bun install
```

### 4. Start development servers

```bash
# Terminal 1 — Backend
cd backend
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
cd frontend
bun run dev
```

The frontend will be available at **http://localhost:5173** and the backend API at **http://localhost:8000**.

### 5. Configure API keys in the UI

Once the app loads, click the **Settings** icon and enter your:
- **OpenRouter API key** — used for LLM chat completions
- **E2B API key** — used to provision cloud sandboxes

## Docker Deployment

```bash
# Build the production image
docker build -t vibe-coder .

# Run
docker run -p 8000:8000 vibe-coder
```

The Docker image compiles the frontend into static assets and serves them alongside the FastAPI backend on a single port.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/chat` | Start agent chat (SSE stream) |
| `POST` | `/api/chat/stop` | Stop running agent |
| `POST` | `/api/chat/reset` | Reset agent session |
| `POST` | `/api/models` | List available LLM models |
| `GET` | `/api/memory` | Get agent memory state |
| `GET` | `/api/files` | List sandbox files |
| `POST` | `/api/files/read` | Read a sandbox file |
| `POST` | `/api/sandbox/create` | Create E2B sandbox |
| `GET` | `/api/sandbox/status` | Sandbox status |
| `POST` | `/api/sandbox/keepalive` | Extend sandbox timeout |
| `WS` | `/ws/terminal/{session_id}` | Interactive terminal |
| `WS` | `/ws/terminal/{session_id}/{terminal_id}` | Multi-terminal |

## Agent Tools

The ReAct agent uses native function calling (no prompt-based parsing) with these tools:

| Tool | Description |
|------|-------------|
| `file_write` | Create or overwrite a file |
| `file_read` | Read file contents with line numbers |
| `replace_in_file` | Targeted string replacement |
| `insert_line` | Insert content after a specific line |
| `delete_lines` | Delete lines by number or range |
| `delete_str` | Delete exact string occurrence |
| `shell` | Execute shell commands in a persistent terminal |

## License

This project is provided as-is for personal and educational use.