# Shall Tool Terminal Execution

## Overview
Add a new native tool, `shall_tool`, that lets the LLM run shell commands inside the active Novita sandbox. The tool must support persistent terminal reuse keyed by `session_name`, synchronous execution with a 3-minute timeout, asynchronous/background execution, and full terminal-output return semantics. The frontend must display `shall_tool` use as a collapsible tool block whose expanded content shows the terminal results.

## Goals
- Register `shall_tool` alongside the existing native function tools.
- Execute commands inside the active Novita sandbox instead of the local backend container.
- Reuse or create persistent terminal sessions automatically based on `session_name`.
- Return full command output to the LLM even when the command exits non-zero.
- Support `wait_for_output=true` and `wait_for_output=false` behaviors.
- Display command execution details and output in the chat UI.

## Scope / non-goals
### In scope
- Tool schema registration.
- Backend execution logic in the sandbox/tooling layer.
- Persistent session bookkeeping for terminal shells.
- Tool result payload shape for shell execution.
- Frontend rendering for shall_tool cards with expandable output.

### Non-goals
- Building a full browser terminal emulator.
- Streaming live terminal output token-by-token to the UI.
- Arbitrary local host shell execution outside the Novita sandbox.
- Multi-user persisted storage of shell sessions beyond the in-memory chat session lifecycle.

## User flows / UX / design notes
1. The model decides to call `shall_tool` via native tool calling.
2. The tool receives `session_name`, `command`, and optional `wait_for_output`.
3. Backend ensures a persistent shell exists for that `session_name` inside the active sandbox:
   - reuse existing shell if alive
   - create a new shell automatically if missing
4. If `wait_for_output=true`, the backend waits up to 180 seconds, captures terminal output, and returns it.
5. If `wait_for_output=false`, the backend starts the command asynchronously and returns a started confirmation.
6. The frontend shows a compact tool block with session name and command, and an expandable area with the captured terminal output.

## Functional requirements
1. `TOOL_SCHEMAS` must include a function tool named `shall_tool` with parameters:
   - `session_name: string`
   - `command: string`
   - `wait_for_output: boolean = true`
2. The tool must be available to the LLM through the API `tools` parameter with no prompt-simulated tool calls.
3. Tool execution must happen in the current Novita sandbox session.
4. Session reuse rules:
   - if a shell for `session_name` exists and is alive, reuse it
   - otherwise create a new terminal session automatically
5. `wait_for_output=true`:
   - run the command in the persistent shell
   - wait for completion up to 180 seconds
   - return full output (stdout + stderr / PTY output), exit code, and metadata
6. `wait_for_output=false`:
   - start the command without blocking the request
   - return a simple started confirmation plus session metadata
7. Non-zero command exit codes must not suppress tool output; output must still be returned to the model.
8. The frontend must create a chat/tool card for `shall_tool` executions and show result details in a dropdown/expandable region.
9. Resetting a chat session must also clean up any persistent shell sessions owned by that chat session.

## Data model / schema
### Tool input schema
```json
{
  "type": "object",
  "properties": {
    "session_name": {
      "type": "string",
      "description": "The name of the session to execute the command in."
    },
    "command": {
      "type": "string",
      "description": "The shell command to execute."
    },
    "wait_for_output": {
      "type": "boolean",
      "description": "If true, wait for the command to finish and return output. If false, run in background.",
      "default": true
    }
  },
  "required": ["session_name", "command"]
}
```

### Backend session state additions
- `terminal_sessions: dict[str, PersistentTerminalSession]`
- per terminal session:
  - `session_name`
  - `pid`
  - `created_at`
  - `last_used_at`
  - `status`

### Tool result shape
- `success: boolean`
- `session_name: string`
- `command: string`
- `wait_for_output: boolean`
- `output: string`
- `exit_code: int | null`
- `timed_out: boolean`
- `started: boolean`
- optional metadata fields like `pid` and `sandbox_id`

## API contracts
- No new public HTTP endpoints are required.
- Existing `POST /api/chat` SSE flow will emit:
  - generic `tool_call` for `shall_tool`
  - generic `tool_result` for `shall_tool`
- Frontend should consume those events and render a shall-tool-specific UI card.

## Edge cases / failure modes
- Sandbox is not ready when tool executes.
- `session_name` refers to a dead shell process; backend should recreate it.
- Command contains multiline shell content.
- Command produces large output.
- Command exceeds 180 seconds.
- Command exits non-zero or writes only stderr.
- Sentinel parsing or PTY prompt noise must not swallow the actual command output.

## Acceptance criteria
- The LLM can select `shall_tool` via native tool calling.
- Repeated calls with the same `session_name` reuse the same persistent sandbox shell when available.
- The tool returns terminal output for both success and failure cases.
- `wait_for_output=false` returns immediate started confirmation.
- The frontend shows a collapsible tool block with command details and terminal output.
- Chat reset cleans up shell sessions.

## Test plan / test cases
- Backend unit tests for tool schema registration and executor wiring.
- Backend tests for:
  - new session creation when `session_name` is unseen
  - shell reuse when `session_name` already exists
  - non-zero exit handling still returning output
  - timeout behavior at 180 seconds
  - async/background command start path
- Frontend tests/manual verification that shall_tool renders as a dropdown tool block.
- Manual end-to-end test using the running app.

## Implementation notes
- Use the installed Novita SDK surface already present in the repo.
- Prefer a PTY-backed interactive bash session for persistent shells because it preserves shell state between commands.
- Use a command completion sentinel to detect the end of a command in a long-lived PTY session.
- Return combined terminal output to the model without truncation inside the backend result payload.
- Keep the tool name spelled exactly `shall_tool` to match the requested contract.

## Status / open questions
- Status: planned
- Open questions:
  - Whether prompt echoes should be preserved verbatim in returned output or minimally trimmed.
  - Whether to surface asynchronous background job output later or only the start acknowledgement in this iteration.