# POOKIE Full-Stack Architecture: Complete Technical Walkthrough

This document maps every layer of the POOKIE system — from the React frontend to the LangGraph AI brain — to its exact implementation file. Use this as your mental model before touching any code.

---

## The Complete Data Journey (End-to-End)

```
[1] User clicks mic on Dashboard.tsx
       ↓ useAudioAnalyser.ts captures browser mic via Web Audio API
[2] User speaks → STT transcription via browser SpeechRecognition API
       ↓ transcript sent via useAgentSocket.ts → ws.send({ text })
[3] WebSocket hits Django → pookie/asgi.py → ProtocolTypeRouter
       ↓ JwtAuthMiddleware (middleware.py) validates Bearer token from query param
[4] Routed to AgentStreamConsumer (consumers.py) → receive()
       ↓ process_agent_command.delay(text, conversation_id, user_id)
[5] Celery picks up task from Redis queue → tasks.py
       ↓ Sends status: "thinking" via channel_layer.group_send
[6] POOKIEAgent.run(text) called → llm_agent.py
       ↓ InMemoryCache checked (Layer 1) → Tenacity retry wrapper (Layer 2)
       ↓ ChatNVIDIA DeepSeek queried via LangGraph ReAct loop
       ↓ If rate-limited: falls back to OpenRouter Gemma 4 (Layer 3)
[7] Response text returned → XML tags scrubbed with re.sub
       ↓ Text streamed word-by-word via channel_layer.group_send (50ms/word)
[8] TTSEngine.generate_base64(text) called (globally loaded model)
       ↓ Kokoro generates WAV → base64 encoded → sent as audio chunk
[9] Django Channels pushes chunks to WebSocket connection
       ↓ useAgentSocket.ts ws.onmessage fires
[10] chunk_type="text" → appended to messages state → chat bubble updates
     chunk_type="audio" → new Audio(base64url).play() → POOKIE speaks
     chunk_type="status:done" → isThinking set to false
```

---

## Level 1: Authentication & REST (Stateless Security)

### How JWT Auth Works in POOKIE

POOKIE uses a **custom** JWT implementation — NOT Django's built-in auth or SimpleJWT — because we use MongoEngine Documents, not Django's `auth.User`.

**Flow:**
1. User calls `POST /api/v1/auth/login/` with email + password
2. `LoginView` (views.py) validates bcrypt hash
3. `generate_tokens()` (auth.py) creates two JWTs via PyJWT:
   - **Access token:** 15-minute expiry, payload: `{user_id, exp, type: "access"}`
   - **Refresh token:** 7-day expiry, payload: `{user_id, jti, exp, type: "refresh"}`
4. Refresh token hash (SHA-256) stored in `refresh_tokens` MongoDB collection
5. Frontend stores both in `localStorage`

**Subsequent Requests:**
- Every protected endpoint uses `authentication_classes = [PyJWTAuthentication]`
- `PyJWTAuthentication.authenticate()` reads `Authorization: Bearer <token>` header
- Decodes JWT with `settings.SECRET_KEY`, validates `type == "access"`, fetches MongoEngine `User`
- Dynamically sets `user.is_authenticated = True` for DRF compatibility

**Token Rotation (Refresh):**
- `POST /api/v1/auth/refresh/` → `RefreshView` validates refresh token, revokes old `RefreshToken` doc, issues new pair

**Key Files:**
- `core/users/auth.py` — `generate_tokens()`, `PyJWTAuthentication`
- `core/users/views.py` — `RegisterView`, `LoginView`, `RefreshView`
- `core/users/models.py` — `User`, `RefreshToken` MongoEngine documents

---

## Level 2: ASGI & WebSockets (Real-Time Pipe)

### Why ASGI?
Django's default WSGI is synchronous — one request blocks until complete. WebSockets require a persistent, bidirectional connection. ASGI (Asynchronous Server Gateway Interface) handles both simultaneously.

### Traffic Routing (`pookie/asgi.py`)
```python
ProtocolTypeRouter({
    "http": django_asgi_app,          # All HTTP → standard Django
    "websocket": JwtAuthMiddleware(   # All WS → verified → consumer
        URLRouter(websocket_urlpatterns)
    )
})
```

### WebSocket Auth (`core/websockets/middleware.py`)
`JwtAuthMiddleware` intercepts the WebSocket handshake before the connection is accepted:
- Reads `?token=<jwt>` from the WebSocket URL query string
- Decodes and validates the JWT
- Injects the authenticated `User` MongoEngine document into `scope["user"]`
- If invalid → connection rejected with code 4001

### WebSocket Consumer (`core/websockets/consumers.py`)
`AgentStreamConsumer(AsyncWebsocketConsumer)`:
- `connect()` → joins Django Channels group `chat_{conversation_id}` — this is the "room" that Celery pushes messages to
- `receive()` → extracts `text` from JSON, calls `process_agent_command.delay()` using `sync_to_async` (needed because Celery's `.delay()` is synchronous)
- `agent_message()` → handler that receives group_send events and forwards them to the WebSocket client

### Frontend Hook (`frontend/src/hooks/useAgentSocket.ts`)
- Opens `ws://localhost:8000/ws/stream/{conversationId}/?token={token}`
- `onmessage` handles three chunk types: `text` (appended to messages), `audio` (played via Web Audio), `status` (updates thinking/done states)
- `sendCommand(text)` → optimistically adds user message → `ws.send({ text })`

---

## Level 3: Celery & Message Brokers (Non-Blocking AI)

### The Problem Without Celery
If the WebSocket consumer directly called `POOKIEAgent.run()`, the Django Channels worker process would be blocked for 2–5 seconds per user, preventing any other WebSocket from being handled.

### How Celery Solves This
```
WebSocket Consumer          Redis Queue           Celery Worker
      │                          │                      │
      │── .delay(text, ...) ───► │ ◄─── task waiting ──►│
      │   (returns instantly)    │                      │── AI thinks...
      │                          │                      │── streams chunks
      │ ◄── group_send ─────────────────────────────── │
```

1. Consumer calls `process_agent_command.delay(...)` — this puts a "ticket" in Redis and returns immediately
2. Celery worker (separate OS process) picks up the ticket
3. Worker runs AI, streams results back via `channel_layer.group_send()`
4. Consumer receives via `agent_message()` event handler → forwards to WebSocket

### Task Flow (`core/agent/tasks.py`)
```python
# 1. Status: thinking
# 2. agent_instance.run(text) → response_text
# 3. Stream text word-by-word (50ms delay between words)
# 4. tts_engine.generate_base64(response_text) → base64 audio
# 5. Send audio chunk
# 6. Status: done
# 7. [TODO Bug B7] Save to MongoDB conversations collection
```

**Critical Optimization:** `tts_engine = TTSEngine()` is at module level — loaded ONCE when the Celery worker boots. Kokoro TTS takes ~3 seconds to load. If it were inside the task function, every response would have a 3-second TTS cold start.

---

## Level 4: The AI Brain (LangGraph ReAct Agent)

### Architecture (`core/agent/llm_agent.py`)

```
POOKIEAgent
├── Layer 1: InMemoryCache        → same query = instant cached response
├── Layer 2: Tenacity @retry      → rate limit errors: wait 1s, 2s, 4s then raise
└── Layer 3: LLM Routing
    ├── Primary: ChatNVIDIA (deepseek-ai/deepseek-v4-flash)
    └── Fallback: ChatOpenAI via OpenRouter (google/gemma-4-31b-it:free)
```

### LangGraph ReAct Loop
`create_react_agent(llm, tools, prompt, checkpointer)` creates a graph that:
1. **Reason** — LLM decides if it needs a tool
2. **Act** — If yes: invokes the tool, observes result
3. **Repeat** — Feeds result back to LLM, decides if answer is ready
4. **Respond** — Returns final answer

### Memory & State
- `MemorySaver()` as `checkpointer` — saves graph state at every node
- `config = {"configurable": {"thread_id": "pookie_local_session"}}` — all conversations share one local thread (multi-user thread IDs is a future task)
- Memory persists across calls within the same Celery worker lifetime (in-process RAM)

### Response Sanitization
After LLM response is received, two regex passes clean hallucinated artifacts:
```python
re.sub(r'\(function=[^>]+>.*?</function>\)', '', text)  # Tool call artifacts
re.sub(r'<[^>]+>', '', text)                             # XML tags (e.g., <think>)
```
This prevents the TTS engine from speaking raw XML tags.

### Currently Registered Tools
- `get_current_time` — returns current time string
- **All other tools from TRD (WebSearchTool, FileManagerTool, etc.) are NOT yet implemented**

---

## Level 5: Resource Optimization & Resilience

### What's Optimized (Currently Working)
| Optimization | Implementation | Benefit |
|---|---|---|
| LLM Caching | `set_llm_cache(InMemoryCache())` in `llm_agent.py` | Zero API cost on repeated queries |
| Global TTS | `tts_engine = TTSEngine()` at module level in `tasks.py` | No 3s cold start per response |
| requestAnimationFrame | `useAudioAnalyser.ts` uses RAF loop | Ties UI updates to monitor refresh rate; no CPU waste from setInterval |
| XML Scrubbing | `re.sub` before TTS | Prevents TTS from reading `<think>` tags |
| JWT Stateless Auth | `PyJWTAuthentication` — no DB read per request | Massive read reduction vs session auth |
| Pagination | `skip()` + `limit(20)` in `ConversationListView` | Never loads all messages into memory |

### What's NOT Yet Optimized (Known Gaps)
| Gap | File | Fix in Step |
|---|---|---|
| Agent singleton | `tasks.py` L27 — re-instantiated per task | Step 11.0 (Bug B3) |
| Conversation persistence | `tasks.py` — messages never saved to MongoDB | Step 11.5 (Bug B7) |
| WebSocket reconnect | `useAgentSocket.ts` — no reconnect logic | Step 11.3 |
| CORS lockdown | `settings.py` — `CORS_ALLOW_ALL_ORIGINS = True` | Step 16 |

---

## Services Reference (Local Development)

| Service | Command | Port | Purpose |
|---|---|---|---|
| MongoDB | `mongod` | 27017 | Primary database |
| Redis | `redis-server` | 6379 | Celery broker + Channels layer |
| Django | `python manage.py runserver` | 8000 | HTTP + WebSocket (via Daphne) |
| Celery | `celery -A pookie worker --loglevel=info --pool=solo` | — | Background task worker |
| Frontend | `npm run dev` | 5173 | React dev server |
| Voice Loop | `python listener.py` | — | Local wake word + voice pipeline |

---

## MongoDB Collections Status

| Collection | Model File | Status |
|---|---|---|
| `users` | `core/users/models.py` → `User` | ✅ Implemented |
| `conversations` | `core/conversations/models.py` → `Conversation` | ✅ Implemented |
| `refresh_tokens` | `core/users/models.py` → `RefreshToken` | ✅ Implemented |
| `command_logs` | — | ❌ Not yet implemented |
| `reminders` | — | ❌ Not yet implemented |
