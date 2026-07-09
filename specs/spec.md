# Anygent Novita Sandbox Integration Spec

## Project overview
Anygent is a split frontend/backend agent application. The frontend is a React + Vite + Zustand UI for chat, file viewing, and computer/code activity. The backend is a FastAPI ReAct agent server that streams LLM reasoning and tool execution events over SSE. Today, tool execution uses an in-memory per-session filesystem. This project replaces that with a sandbox-provider architecture and adds Novita Agent Sandbox as the first production provider.

## Goals
- Replace local in-memory tool execution with sandbox-backed execution.
- Add first-class Novita sandbox support using the official Python SDK.
- Make sandbox creation automatic on first chat request and block tool/chat execution until sandbox creation succeeds.
- Persist and display sandbox-backed files from `/home/user/` in the application file explorer.
- Add extensible abstractions so future sandbox services can be added without rewriting agent logic.
- Wire the frontend to a live backend URL through environment configuration.

## Design direction
- Keep the existing dark, IDE-like product UI.
- Add a polished status treatment for sandbox provisioning with animated "Creating sandbox..." feedback and shine effect.
- Keep settings minimal but explicit: LLM provider key plus Novita sandbox key and optional template ID.
- Treat the sandbox as the source of truth for filesystem and tool operations.

## Technical stack decisions
- Frontend: React 19, Vite, TypeScript, Zustand.
- Backend: FastAPI, Python.
- Sandbox SDK: official Python package `novita-sandbox`.
- Version policy: install the latest available stable SDK release unless the integration requires beta-only APIs; implementation should centralize SDK calls behind a provider interface.
- Sandbox root path shown in UI: `/home/user/`.
- Sandbox lifetime target: 1 hour (`3600` seconds), with connect/update logic keeping timeout aligned.
- No database required.

## Architecture rules
- ReAct agent logic must not call Novita SDK directly; use a sandbox service abstraction.
- Tool execution, file read/write/replace, and filesystem listing must resolve through the active sandbox provider.
- Frontend local file cache mirrors sandbox state and refreshes from backend APIs, not from speculative client-only state.
- Session-specific sandbox state must be isolated by chat session.
- Existing SSE event patterns should be preserved when possible; new sandbox lifecycle events may be added without breaking current flows.
- Settings should persist only user-entered non-server secrets in client storage as already established by the app.
- Backend env files must keep server-side defaults/configuration, while sandbox credentials are passed per request from settings.

## Feature list
| Feature | Status | Spec |
|---|---|---|
| Sandbox provider abstraction | planned | `specs/sandbox-provider-abstraction/document.md` |
| Novita backend integration | planned | `specs/novita-backend-integration/document.md` |
| Sandbox-aware frontend UX | planned | `specs/sandbox-aware-frontend/document.md` |