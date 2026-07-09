# Sandbox Provider Abstraction

## Overview
Introduce a provider-agnostic sandbox service layer that manages sandbox lifecycle, tool execution context, and filesystem access. Novita is the first implementation, but the agent, tool executor, and API surface should depend on interfaces/protocols rather than SDK-specific details.

## Goals
- Decouple agent/tool logic from Novita-specific SDK calls.
- Support sandbox lifecycle operations: create, connect/reuse, set timeout, inspect status, and destroy/reset.
- Support provider-backed filesystem read/write/replace/list operations.
- Support provider-backed command execution for future tools.
- Allow easy registration of additional providers later.

## Scope / non-goals
### In scope
- Backend abstraction classes/modules for provider state and operations.
- Session-level sandbox manager and provider selection.
- Shared result models used by the tool executor and API responses.

### Non-goals
- Multi-provider UI switching in this iteration.
- Migrating the app to long-lived multi-user auth.
- Implementing advanced provider capabilities beyond what current tools need.

## User flows / UX / design notes
- End users do not choose a provider in the first release; they configure Novita-specific credentials and template ID.
- Users experience the abstraction only through reliable sandbox-backed files/tools.

## Functional requirements
1. The backend must expose a session-scoped sandbox manager.
2. The sandbox manager must lazily create or connect to a sandbox for a session.
3. The abstraction must provide methods for:
   - ensure sandbox exists
   - get sandbox metadata/state
   - set timeout
   - list files under `/home/user`
   - read file
   - write file
   - replace exact text in file
   - optionally execute shell commands for future tools
   - clear/kill sandbox on reset when appropriate
4. Tool executor must call the abstraction instead of in-memory dictionaries.
5. File results returned to the agent/frontend must remain structured and compatible with current UI patterns.

## Data model / schema
- `SandboxConfig`
  - provider: string
  - api_key: string
  - template_id: string | null
  - timeout_seconds: int (default 3600)
- `SandboxSessionState`
  - session_id: string
  - sandbox_id: string | null
  - provider: string
  - status: `idle|creating|ready|error|paused`
  - template_id: string | null
  - root_path: `/home/user`
  - last_error: string | null
  - created_at / updated_at timestamps
- `SandboxFileEntry`
  - path, name, type, size, modified_time

## API contracts
- Internal backend service contract only in this feature:
  - `ensure_ready(session_id, config) -> SandboxSessionState`
  - `list_files(session_id, root_path='/home/user', depth=...) -> list[SandboxFileEntry]`
  - `read_file(session_id, file_path) -> {success, content, raw_content, ...}`
  - `write_file(session_id, file_path, content) -> {success, file_path, content, ...}`
  - `replace_in_file(session_id, file_path, old_string, new_string) -> {success, occurrences, new_content, ...}`
  - `reset_session(session_id)`

## Edge cases / failure modes
- Invalid Novita API key.
- Invalid or unavailable template ID.
- Sandbox creation timeout/failure.
- Sandbox expires mid-run and must reconnect or fail clearly.
- File read on missing file.
- Replace operation with zero matches.
- Provider SDK/network errors must become structured user-facing errors.

## Acceptance criteria
- Tool executor no longer uses in-memory `_session_files` as source of truth.
- Sandbox lifecycle is managed through provider abstraction.
- Future providers can be added by implementing the same interface without rewriting the ReAct loop.

## Test plan / test cases
- Unit test service behavior with mocked provider methods.
- Verify write -> read -> replace flow through abstraction.
- Verify reset clears session sandbox state.
- Verify provider errors are surfaced as structured failures.

## Implementation notes
- Prefer small modules: provider base/protocol, novita provider, sandbox manager/state store.
- Keep session state in memory for now, keyed by session ID.
- Preserve current backend response fields to minimize frontend churn.

## Status / open questions
- Status: planned
- Open questions:
  - Whether sandbox reset should kill vs pause the sandbox for cost/performance trade-offs.
  - Whether to auto-reconnect paused sandboxes on subsequent chat turns.