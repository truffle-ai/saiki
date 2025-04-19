# Web App & Event Streaming Architecture

**Status:** Proposed  
**Owner:** [Your Name/Team]  
**Date:** 2024-07-26

## Overview

This plan outlines the transition from a CLI-only agent to a web application with real-time event streaming and a modern React-based UI. The goal is to leverage the existing event-driven agent architecture to provide a responsive, interactive web experience, while maintaining code reuse and extensibility.

## Goals

* Provide a web-based UI for the agent, supporting real-time, streaming interaction.
* Reuse the existing agent core, event manager, and LLM service logic.
* Support multiple simultaneous users (sessions) in the future.
* Maintain a clean separation between backend (agent logic, event streaming) and frontend (UI).
* Enable easy extension for future features (authentication, advanced UI, etc).

## Non-Goals

* Implementing user authentication or persistent user accounts at this stage.
* Supporting deployment to production (focus is on local development and usage).
* Major changes to the agent's core event mechanism (reuse as much as possible).

## Architecture

### High-Level Design

- **Backend:** Node.js/Express server, initializes agent services, exposes REST API and WebSocket event streaming, serves static frontend files.
- **Frontend:** React app (bundled to `public/`), connects via REST and WebSocket, provides chat UI and real-time updates.
- **Event Streaming:** Uses WebSockets to push agent events (thinking, chunk, toolCall, toolResult, response, error, conversationReset) to the browser in real time.

## Backend Plan

### 1. Express Server Setup
- Create `webapp.ts` in `app/`.
- Initialize agent services (ClientManager, LLMService, etc) as in `cli.ts`.
- Serve static files from `public/` (React build output).

### 2. REST API Endpoints
- `POST /api/message` — Accepts user input, calls `llmService.completeTask`, returns final response.
- `POST /api/reset` — Resets conversation state.
- (Optional) `GET /api/tools`, `GET /api/config` — Expose available tools/model info.

### 3. WebSocket Event Streaming
- Integrate `ws` (WebSocket) server with Express.
- On client connect:
  - Create a new `WebSubscriber` (implements `AgentSubscriber`).
  - Register with `LLMServiceEventManager`.
  - On disconnect, remove the subscriber.
- As agent emits events, `WebSubscriber` sends them to the frontend in real time.

### 4. Session Management
- For now, use in-memory session per WebSocket connection.
- (Optional) Add user/session IDs for multi-user support in the future.

## Frontend Plan

### 1. Project Structure
- Source in `frontend/`, build output in `public/`.
- Main files: `App.tsx`, `index.tsx`, `api.ts` (for API/WebSocket logic).

### 2. UI Features
- Chat interface: message input, message history, streaming responses.
- Real-time updates: show "thinking", tool calls/results, and partial responses as they arrive.
- "Reset" button to clear conversation.
- (Optional) Display available tools and model info.

### 3. WebSocket Client
- On page load, open a WebSocket connection to the backend.
- Listen for event messages and update the UI accordingly.
- On user input, send message via REST API or WebSocket (depending on backend design).

## Implementation Plan / Task List

* [ ] Set up Express server and static file serving in `webapp.ts`.
* [ ] Implement REST API endpoints for message and reset.
* [ ] Integrate WebSocket server for event streaming.
* [ ] Implement `WebSubscriber` (see `event-mechanism.md` for pattern).
* [ ] Set up React project in `frontend/`, build to `public/`.
* [ ] Implement chat UI and WebSocket event handling in React.
* [ ] Implement message sending and reset functionality in frontend.
* [ ] End-to-end test: user can chat with agent, see real-time updates, and reset conversation.

## References

* See `event-mechanism.md` for current event system details and subscriber pattern.
* See `cli.ts` and `event-manager.ts` for CLI and event manager usage.
* See `vercel.ts` for sample event emission in LLM service.

## Open Questions

* Should we support both REST and WebSocket message sending, or just one?
* How should we handle session persistence for multi-user support in the future? 