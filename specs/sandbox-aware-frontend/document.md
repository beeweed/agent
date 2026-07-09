# Sandbox-Aware Frontend UX

## Overview
Update the frontend so users configure Novita sandbox credentials in settings, see sandbox provisioning feedback during first-run chat, and browse files sourced from the backend-managed Novita sandbox.

## Goals
- Add Novita sandbox API key input and custom template ID input to settings.
- Prevent chat submission until both the active LLM key and sandbox key are present.
- Show an animated "Creating sandbox..." state in place of the existing thinking treatment while the first sandbox is being provisioned.
- Keep file tree and file panels synchronized with backend sandbox contents.

## Scope / non-goals
### In scope
- Zustand state additions for Novita settings and sandbox status.
- Settings modal updates.
- ChatPanel event handling for sandbox lifecycle events.
- ThinkingIndicator/related UI updates.
- File loading from backend sandbox APIs.

### Non-goals
- Full redesign of the application shell.
- Exposing advanced Novita controls beyond API key/template ID.

## User flows / UX / design notes
1. User opens Settings.
2. User enters Novita sandbox API key and optional custom template ID.
3. On first send, if sandbox not ready, UI displays animated provisioning card/indicator: “Creating sandbox...” with shine effect.
4. If provisioning fails, show actionable error and keep chat blocked.
5. After provisioning, standard agent/tool streaming resumes.
6. File explorer shows `/home/user` contents from backend.

## Functional requirements
1. Settings dialog must include:
   - Novita sandbox API key input (password field)
   - Custom sandbox template ID input (plain text, optional)
2. Persist those settings in the existing local persisted store.
3. Chat submit must refuse to start if sandbox key is missing; open settings instead.
4. Frontend must recognize new SSE event types for sandbox lifecycle.
5. Thinking/progress indicator must support a special `creating sandbox` visual mode with animation and shine.
6. File tree refresh must call backend sandbox endpoints instead of only building from local optimistic cache.
7. File reading in the panel should come from backend sandbox content, with local cache only as a render optimization.

## Data model / schema
- Store additions:
  - `novitaApiKey: string`
  - `novitaTemplateId: string`
  - `sandboxStatus: 'idle' | 'creating' | 'ready' | 'error'`
  - `sandboxMessage: string`
- Event additions mirror backend SSE additions.

## API contracts
- `sendMessage()` request body includes Novita settings.
- `fetchFileTree()` should request backend sandbox file data.
- `readFile()` should request backend sandbox file content when not cached or when refresh is needed.

## Edge cases / failure modes
- Missing sandbox key.
- Sandbox creation failure after user send.
- Backend file endpoint unavailable.
- Empty sandbox directory.
- Reset state should clear file explorer and sandbox status back to idle.

## Acceptance criteria
- Settings popup contains working Novita inputs.
- User cannot chat without sandbox credentials.
- First-run provisioning shows animated “Creating sandbox...” status.
- File explorer reflects backend sandbox files under `/home/user`.

## Test plan / test cases
- Manual UI test of settings persistence.
- Manual chat submit with missing sandbox key opens settings and blocks request.
- Manual happy-path SSE lifecycle rendering.
- Manual file panel refresh from backend sandbox data.

## Implementation notes
- Reuse current visual language; add a subtle shimmer/shine animation rather than a new component family.
- Preserve existing chat entry types when possible; add a small dedicated system/progress entry type only if necessary.
- Avoid storing backend-only status permanently in persisted state.

## Status / open questions
- Status: planned
- Open questions:
  - Whether template ID should be shown for all users or tucked behind an advanced section.