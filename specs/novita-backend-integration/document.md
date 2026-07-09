# Novita Backend Integration

## Overview
Integrate Novita Agent Sandbox into the FastAPI backend using the official Python SDK so every agent tool interaction happens inside a Novita sandbox rather than local process memory.

## Goals
- Use the official Python SDK package `novita-sandbox`.
- Create a sandbox automatically on the first user chat input.
- Support optional custom template ID from settings.
- Enforce a 1-hour timeout and keep it refreshed through SDK APIs.
- Route file write/read/replace and filesystem listing to the Novita sandbox rooted at `/home/user/`.
- Emit backend events/logs for sandbox creation lifecycle.

## Scope / non-goals
### In scope
- Backend request model changes for Novita settings.
- Novita provider implementation.
- Tool executor migration to sandbox-backed operations.
- New backend endpoints or enriched existing endpoints for sandbox state/filesystem sync.

### Non-goals
- Browser automation inside Novita.
- Persistent database of sandbox sessions.
- Server-side storage of user sandbox keys.

## User flows / UX / design notes
1. User enters LLM provider key and Novita sandbox key in settings, optionally a template ID.
2. User sends the first chat message.
3. Backend creates/connects a Novita sandbox, sets/ensures timeout 3600s, then begins agent execution.
4. Tool calls read/write/replace files inside sandbox `/home/user/...`.
5. Frontend file explorer reflects the sandbox filesystem.

## Functional requirements
1. Chat request payload must accept Novita sandbox API key and optional template ID.
2. On the first chat request for a session, backend must create a sandbox before continuing agent execution.
3. Backend must log sandbox creation start/success/failure.
4. Agent event stream must include sandbox creation status events that frontend can render.
5. Sandbox creation must support:
   - default template when custom template ID is absent
   - custom template ID when provided
   - timeout of 3600 seconds
6. File tool implementations must use the sandbox filesystem APIs.
7. Filesystem listing endpoint(s) must fetch files from `/home/user/` in the sandbox, not client memory.
8. Reset behavior must clear conversation context and sandbox-backed file cache; sandbox disposal should be deterministic.

## Data model / schema
### Request additions
- `novita_api_key: str | None`
- `novita_template_id: str | None`

### Event additions
- `sandbox_creation_start`
- `sandbox_creation_log`
- `sandbox_creation_end`
- `sandbox_error`
- optional `sandbox_status`

### Backend models
- `SandboxSettingsPayload`
- `SandboxStateResponse`
- `SandboxFileTreeResponse`

## API contracts
- `POST /api/chat`
  - request extends current chat payload with Novita fields
  - SSE may emit sandbox lifecycle events before iteration/tool events
- `GET /api/files` or equivalent
  - returns sandbox-backed file tree/content under `/home/user`
- `POST /api/chat/reset`
  - resets agent context and session sandbox state
- `GET /api/sandbox/status`
  - optional state summary for UI hydration

## Edge cases / failure modes
- Missing Novita key when user tries to chat.
- LLM provider key present but sandbox key missing: request must be blocked.
- SDK import or incompatible version failure.
- Template not found.
- Sandbox exists but is paused or timed out: reconnect and reset timeout if possible.
- Partial file tree failures should not corrupt session state.

## Acceptance criteria
- First chat request creates sandbox before any tool execution.
- All current file tools operate against Novita sandbox files.
- Files displayed in UI originate from `/home/user/` in the sandbox.
- Backend uses official `novita-sandbox` SDK and sets timeout to 3600 seconds.
- Template ID from settings is honored.

## Test plan / test cases
- Mock Novita provider in backend tests for create/connect/write/read/replace/list.
- Validate `/api/chat` rejects missing sandbox key.
- Validate sandbox creation events arrive before tool execution.
- Validate file tree endpoint returns sandbox contents rooted at `/home/user`.
- Validate reset clears session state.

## Implementation notes
- Use SDK methods documented/researched: `Sandbox.create(template=..., timeout=3600, metadata={...})`, `sandbox.set_timeout(3600)`, `sandbox.files.read`, `sandbox.files.write`, `sandbox.files.list`, `sandbox.commands.run` if needed.
- Prefer `novita_sandbox.core.Sandbox` or `novita_sandbox.code_interpreter.Sandbox` consistently; wrap inside provider to insulate the rest of the app.
- Root all tool file paths into `/home/user` when model paths are relative or outside allowed root.

## Status / open questions
- Status: planned
- Open questions:
  - Whether to kill or pause on reset.
  - Whether to auto-normalize absolute non-`/home/user` paths requested by the model.