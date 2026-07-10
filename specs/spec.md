# Anygent Sandbox Tooling Spec

## Project overview
Anygent is a split frontend/backend agent application. The frontend is a React + Vite + Zustand UI for chat, file viewing, and computer/code activity. The backend is a FastAPI ReAct agent server that streams LLM reasoning and tool execution events over SSE. The current codebase already routes file tools through a Novita-backed sandbox provider. This iteration adds a new persistent terminal tool, `shall_tool`, so the LLM can execute shell commands inside the active Novita sandbox and expose those results in both the tool protocol and the UI.

## Goals
- Preserve the existing sandbox-backed file tooling architecture.
- Add a new native-function tool named `shall_tool` to the LLM tool registry.
- Execute shell commands inside the active Novita sandbox with per-session persistent shell reuse keyed by `session_name`.
- Return full terminal output to the LLM even when the shell command exits with an error.
- Support synchronous waits up to 3 minutes and asynchronous background execution.
- Surface `shall_tool` activity in the frontend as a collapsible tool block with terminal output.
- Keep the frontend wired to a live backend URL through environment configuration.

## Design direction
- Keep the existing dark, IDE-like product UI.
- Keep the existing sandbox provisioning treatment and settings UX.
- Add a terminal-result presentation that feels native to the current developer-tool aesthetic: compact tool card, clear status, monospace output, expandable details.
- Treat the sandbox as the source of truth for filesystem and tool operations.

## Technical stack decisions
- Frontend: React 19, Vite, TypeScript, Zustand.
- Backend: FastAPI, Python.
- Sandbox SDK: official Python package `novita-sandbox`.
- Version policy: use the current repo-pinned stable SDK `novita-sandbox==2.0.6` unless a verified incompatibility requires adjustment.
- Sandbox root path shown in UI: `/home/user/`.
- Sandbox lifetime target: 1 hour (`3600` seconds), with connect/update logic keeping timeout aligned.
- Persistent terminal sessions should be implemented with Novita process APIs that support reusable shell state, favoring PTY-backed interactive bash sessions when command reuse requires shell continuity.
- `shall_tool` synchronous waits time out after 180 seconds.
- No database required.

## Architecture rules
- ReAct agent logic must not call Novita SDK directly; use a sandbox service abstraction.
- Tool execution, file read/write/replace, and filesystem listing must resolve through the active sandbox provider.
- `shall_tool` must be registered as a native LLM tool schema and executed through the backend tool executor path; tool calls must come from the model API protocol, not prompt text.
- Persistent shell session bookkeeping must remain isolated by chat session and by `session_name` inside that chat session.
- Terminal output should always be captured and returned to the model in a structured result, regardless of shell exit status.
- Frontend local file cache mirrors sandbox state and refreshes from backend APIs, not from speculative client-only state.
- Session-specific sandbox state must be isolated by chat session.
- Existing SSE event patterns should be preserved when possible; new sandbox lifecycle events may be added without breaking current flows.
- Settings should persist only user-entered non-server secrets in client storage as already established by the app.
- Backend env files must keep server-side defaults/configuration, while sandbox credentials are passed per request from settings.

## Feature list
| Feature | Status | Spec |
|---|---|---|
| Sandbox provider abstraction | done | `specs/sandbox-provider-abstraction/document.md` |
| Novita backend integration | done | `specs/novita-backend-integration/document.md` |
| Sandbox-aware frontend UX | done | `specs/sandbox-aware-frontend/document.md` |
| Shall tool terminal execution | planned | `specs/shall-tool/document.md` |