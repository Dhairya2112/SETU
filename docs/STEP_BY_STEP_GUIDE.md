# POOKIE — Master Implementation Guide (Source of Truth)

> **AI RULE:** This is the STRICT execution order. Never skip ahead. Never implement a future phase step without completing the current one. Always check the status markers below before writing any code.

---

## STATUS LEGEND
- ✅ **COMPLETED** — Code exists and is verified working
- ⚠️ **PARTIAL** — Code exists but has known gaps/bugs (see notes)
- ➡️ **NEXT** — This is the immediate next task to implement
- ⬜ **PENDING** — Not started, do not touch yet

---

## KNOWN BUGS (Fix these as you encounter them)

| # | File | Bug | Fix |
|---|---|---|---|
| B1 | `backend/listener.py` L24 | Prints "Hey Jarvis" — wrong wake word label | Change print string to "Hey POOKIE" |
| B2 | `backend/core/wake_word/detector.py` L14 | `wakeword_models=['hey_jarvis']` — using Jarvis model instead of POOKIE | Train custom model (Phase 5) or replace with `hey_mycroft` for testing |
| B3 | `backend/core/agent/tasks.py` L27 | `POOKIEAgent()` is instantiated inside the task — loads LLM every call (very slow) | Move `agent = POOKIEAgent()` to module-level, same as `tts_engine` |
| B4 | `backend/core/users/auth.py` L30 | `RefreshToken.objects.create(...)` — `.create()` is a Django ORM method; MongoEngine uses `.save()` | Replace with `RefreshToken(...).save()` |
| B5 | `frontend/src/hooks/useAgentSocket.ts` L19 | hardcoded `conversationId: 'default'` in Dashboard — all users share one WebSocket room | Pass a real UUID from a new conversation API call |
| B6 | `frontend/src/hooks/useAgentSocket.ts` | `status` chunk_type (`thinking`, `done`) is received but never handled — `isThinking` never resets to false on `done` | Add handler for `chunk_type === 'status'` |
| B7 | `backend/core/agent/tasks.py` | Conversation messages are never saved to MongoDB after each exchange | Add `Conversation` model save logic at end of task |
| B8 | `frontend/src/pages/Onboarding.tsx` L57 | Name saved to `localStorage` only — never sent to `PATCH /api/v1/user/profile/` | Wire to API in Step 11.1 |

---

## PHASE 1: Core AI & Local Inference Foundation ✅ COMPLETED

### Step 1: Backend Environment ✅
- Python 3.11 venv created
- Django 6.0.5 project initialized at `backend/`
- All core libraries installed via `requirements.txt`
- Django apps: `core.users`, `core.conversations`, `core.agent`, `core.websockets`, `core.tasks`

### Step 2: Wake Word Detection ✅ (with Bug B2)
- **File:** `backend/core/wake_word/detector.py`
- OpenWakeWord model loaded with `hey_jarvis` (temporary — custom model in Phase 5)
- Silero VAD loaded for end-of-speech detection
- `listen_for_wake_word()` — blocks until score > 0.06 threshold
- `capture_audio_dynamic()` — records 16kHz mono float32 until 700ms silence or 15s timeout
- **Known Issue (B2):** Using Jarvis model as placeholder

### Step 3: Speech-to-Text ✅
- **File:** `backend/core/ai/stt.py`
- Faster-Whisper `small.en` model, `int8` quantization, CPU device
- `transcribe(audio_data)` → joins all segments → returns stripped string
- Audio spec: float32, 16kHz, mono

### Step 4: LangChain Agent Brain ✅ (with Bug B3)
- **File:** `backend/core/agent/llm_agent.py`
- `POOKIEAgent` class with 3-layer resilience:
  - **Layer 1:** `InMemoryCache` — identical queries return cached response (zero latency/cost)
  - **Layer 2:** `@retry` with Tenacity — exponential backoff (1s, 2s, 4s) on rate limit
  - **Layer 3:** `ChatNVIDIA (deepseek-ai/deepseek-v4-flash)` primary → `ChatOpenAI via OpenRouter (google/gemma-4-31b-it:free)` fallback
- `LangGraph create_react_agent` with `MemorySaver` checkpointer
- Thread ID: `pookie_local_session` (single-user local session)
- XML/tool-tag scrubbing via `re.sub` before returning text
- Tools: `get_current_time` (only tool currently registered — more in Phase 5)
- **Known Issue (B3):** Agent re-instantiated per Celery task call

### Step 5: Text-to-Speech ✅
- **File:** `backend/core/ai/tts.py`
- Kokoro `KPipeline(lang_code='a')` — American English
- Voice: `af_heart` (American Female, high quality)
- `speak(text)` — plays locally via sounddevice at 24kHz
- `generate_base64(text)` — generates WAV, encodes to base64 string for WebSocket streaming
- TTS loaded globally in `tasks.py` (correct optimization)

### Step 5.1: Main Listener Loop ✅ (with Bug B1)
- **File:** `backend/listener.py`
- Full voice pipeline: WakeWord → STT → Agent → TTS
- Exit words: `["no", "nope", "bye", "goodbye", "thanks", "stop", "nothing"]`
- Follow-up loop after first interaction
- **Known Issue (B1):** Print statement says "Hey Jarvis"

---

## PHASE 2: Web API, Database & Real-Time Sync ✅ COMPLETED

### Step 6: MongoDB Architecture ✅
- **ODM:** MongoEngine connected in `settings.py` L174 (`pookie_db` on `localhost:27017`)
- **Collections implemented:**
  - `users` → `backend/core/users/models.py` — `User`, `UserPreferences`, `UserPermissions`
  - `conversations` → `backend/core/conversations/models.py` — `Conversation`, `Message`, `MessageMetadata`
  - `refresh_tokens` → `backend/core/users/models.py` — `RefreshToken`
  - ❌ `command_logs` — **NOT YET IMPLEMENTED** (no model file for this collection)
  - ❌ `reminders` — **NOT YET IMPLEMENTED** (tasks app exists but no model)

### Step 6.5: Database Indexes ✅
- `users`: `email` (unique via MongoEngine), `user_id`
- `conversations`: `conversation_id`, `(user_id, -started_at)` compound
- `refresh_tokens`: `expires_at` (TTL=0, auto-expire), `token_hash`

### Step 7: Auth & Security ⚠️ PARTIAL
- **Custom JWT Auth (DONE):**
  - `backend/core/users/auth.py` — `generate_tokens()` creates HS256 JWT (15min access, 7day refresh)
  - `PyJWTAuthentication` — validates `Bearer` token on every protected request
  - `RefreshView` — rotates refresh tokens (revokes old, issues new)
  - `RegisterView`, `LoginView` — local account creation with bcrypt
- **OAuth (NOT CONFIGURED):**
  - `dj-rest-auth` + `allauth` installed, Google/GitHub/Microsoft providers in `INSTALLED_APPS`
  - **Missing:** No OAuth client credentials in `settings.py` or `.env`
  - **Missing:** No `SOCIALACCOUNT_PROVIDERS` dict in settings
  - This is deferred — local auth is working and sufficient for now
- **Known Issue (B4):** `RefreshToken.objects.create()` should be `RefreshToken(...).save()`

### Step 8: REST Endpoints ✅
| Endpoint | View | File | Status |
|---|---|---|---|
| `POST /api/v1/auth/register/` | `RegisterView` | `core/users/views.py` | ✅ |
| `POST /api/v1/auth/login/` | `LoginView` | `core/users/views.py` | ✅ |
| `POST /api/v1/auth/refresh/` | `RefreshView` | `core/users/views.py` | ✅ |
| `GET/PATCH /api/v1/user/profile/` | `UserProfileView` | `core/users/views.py` | ✅ |
| `GET/PATCH /api/v1/user/permissions/` | `UserPermissionsView` | `core/users/views.py` | ✅ |
| `GET /api/v1/conversations/` | `ConversationListView` | `core/conversations/views.py` | ✅ |
| `GET/DELETE /api/v1/conversations/{id}/` | `ConversationDetailView` | `core/conversations/views.py` | ✅ |
| `POST /api/chat/` | `CommandView` | `core/agent/views.py` | ✅ |
| `GET /api/agent/status/{task_id}/` | `StatusView` | `core/agent/views.py` | ⚠️ Mock only |
| `POST/GET /api/v1/reminders/` | — | — | ❌ Not implemented |

### Step 8.5: WebSockets & Celery ✅
- **ASGI Router:** `backend/pookie/asgi.py` — `ProtocolTypeRouter` separates HTTP and WS traffic
- **JWT Middleware:** `core/websockets/middleware.py` — `JwtAuthMiddleware` validates token from query param before accepting WS
- **Consumer:** `core/websockets/consumers.py` — `AgentStreamConsumer`
  - `connect()`: joins `chat_{conversation_id}` channel group
  - `receive()`: dispatches to `process_agent_command.delay()`
  - `agent_message()`: pushes chunks to WebSocket
- **Celery Task:** `core/agent/tasks.py` — `process_agent_command`
  - Sends `status: thinking` → streams text word-by-word (50ms delay) → generates TTS base64 → sends `status: done`
- **Channel Layer:** Redis on `127.0.0.1:6379`
- **Celery Broker/Backend:** Redis on `127.0.0.1:6379/0`

---

## PHASE 3: Desktop App & Bioluminescent Frontend

### Step 9: React Frontend Setup ✅
- **Stack:** React 18 + Vite + TypeScript + TailwindCSS
- **Root:** `frontend/src/App.tsx` — routes `/`, `/auth`, `/onboarding/*`, `/dashboard/*`
- **Background:** `NeuralMesh.tsx` — canvas-based physics particle system (mouse-reactive)
- **Auth:** `Login.tsx` — glassmorphic OAuth card UI (wired to `/api/v1/auth/login/`, stores token in `localStorage`)
- **Routing:** `react-router-dom` installed

### Step 10: Onboarding UI ✅
- **File:** `frontend/src/pages/Onboarding.tsx`
- 3-step wizard with progress indicator dots
- Step 1 (`/onboarding/name`): Name input → saves to `localStorage`
- Step 2 (`/onboarding/hardware`): Mock mic test button → skip/continue
- Step 3 (`/onboarding/permissions`): Level 2 toggle
- Step 4 (`/onboarding/done`): Animated confirmation → saves `pookie_onboarding_completed` flag and redirects to `/dashboard`
- **Updates:** Removed offline AI engine/Llama choice to keep POOKIE fast and lightweight.
- **Missing:** EULA checkbox, API wiring, real mic test

### Step 10.5: UI Polish ⚠️ PARTIAL
- Framer Motion transitions between steps ✅
- Glassmorphic card container ✅
- Skeleton screens ❌ Not implemented
- Error boundaries ❌ Not implemented

---

### Step 11: Connect UI to Backend ✅ COMPLETED

This step made the frontend functional. All sub-steps completed.

#### 11.0: Fix Critical Bugs First
Before any new feature work, fix the bugs that will break integration:

**Fix Bug B3** — `backend/core/agent/tasks.py`:
```python
# BEFORE (broken — re-instantiates LLM every call):
agent = POOKIEAgent()
response_text = agent.run(text)

# AFTER (correct — singleton loaded once at worker boot):
# Add at module level, OUTSIDE the task function:
agent_instance = POOKIEAgent()

# Inside the task:
response_text = agent_instance.run(text)
```

**Fix Bug B4** — `backend/core/users/auth.py` L30:
```python
# BEFORE:
RefreshToken.objects.create(...)
# AFTER:
RefreshToken(
    token_hash=token_hash,
    user_id=user.user_id,
    issued_at=now,
    expires_at=refresh_expiry,
    device_info=device_info
).save()
```

**Fix Bug B6** — `frontend/src/hooks/useAgentSocket.ts`:
```typescript
// Add this block inside ws.onmessage:
} else if (data.chunk_type === 'status') {
    if (data.message === 'thinking') {
        setIsThinking(true);
    } else if (data.message === 'done') {
        setIsThinking(false);
    }
}
```

#### 11.1: Wire Onboarding to Backend API
**File:** `frontend/src/pages/Onboarding.tsx`

After Step 1 (Name), send to profile:
```typescript
// In StepName handleNext(), after localStorage.setItem:
const token = localStorage.getItem('pookie_token');
await fetch('http://localhost:8000/api/v1/user/profile/', {
    method: 'PATCH',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        username: name.trim(),
        preferences: { preferred_name: name.trim() }
    })
});
```


After Step 4 (Permissions), send permissions:
```typescript
// In StepPermissions Complete Setup handler:
await fetch('http://localhost:8000/api/v1/user/permissions/', {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ level_2_granted: level2 })
});
```

#### 11.2: Add EULA to Permissions Step
**File:** `frontend/src/pages/Onboarding.tsx` — `StepPermissions` component

Add below the Level 2 toggle card:
- A scrollable `<div>` (max-h: 150px, overflow-y: auto) containing the EULA text from `docs/EULA_PRIVACY_POLICY.md`
- A mandatory checkbox: `"I have read and agree to the EULA and Privacy Policy"`
- The "Complete Setup" button must be `disabled` until the checkbox is checked AND `eulaAccepted === true`
- On acceptance, store `localStorage.setItem('pookie_eula_accepted', 'true')`

#### 11.3: Fix WebSocket Conversation ID
**File:** `frontend/src/pages/Dashboard.tsx`

Replace hardcoded `conversationId: 'default'` with a real UUID:
```typescript
// Add state:
const [conversationId] = useState(() => {
    const stored = localStorage.getItem('pookie_conversation_id');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('pookie_conversation_id', newId);
    return newId;
});

// Pass to hook:
const { ... } = useAgentSocket({ token, conversationId });
```

#### 11.4: Add Zustand State Management
Install: `npm install zustand @tanstack/react-query`

Create `frontend/src/store/useAppStore.ts`:
```typescript
import { create } from 'zustand';

interface AppState {
    token: string | null;
    username: string;
    conversationId: string;
    eulaAccepted: boolean;
    setToken: (t: string | null) => void;
    setUsername: (u: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
    token: localStorage.getItem('pookie_token'),
    username: 'Agent',
    conversationId: localStorage.getItem('pookie_conversation_id') || crypto.randomUUID(),
    eulaAccepted: localStorage.getItem('pookie_eula_accepted') === 'true',
    setToken: (t) => set({ token: t }),
    setUsername: (u) => set({ username: u }),
}));
```

Wrap `main.tsx` with `QueryClientProvider`.
Replace all `localStorage.getItem('pookie_token')` calls in Dashboard/Onboarding with Zustand store.

#### 11.5: Persist Conversations to MongoDB
**File:** `backend/core/agent/tasks.py`

At the end of `process_agent_command`, before the `done` status push, add:
```python
from core.conversations.models import Conversation, Message, MessageMetadata
import datetime

# Find or create conversation
conv = Conversation.objects(conversation_id=conversation_id).first()
if not conv:
    conv = Conversation(conversation_id=conversation_id, user_id=user_id)

user_msg = Message(role='user', content=text, metadata=MessageMetadata(input_type='text', llm_model='deepseek-ai/deepseek-v4-flash'))
agent_msg = Message(role='assistant', content=response_text, metadata=MessageMetadata(input_type='text', llm_model='deepseek-ai/deepseek-v4-flash'))

conv.messages.append(user_msg)
conv.messages.append(agent_msg)
conv.last_updated = datetime.datetime.now(datetime.timezone.utc)
conv.save()
```

---

## PHASE 3.5: Hardening Sprint — Make POOKIE a Real Agent

> **AI RULE:** This entire phase MUST be completed before Step 17 (Electron packaging). Do not skip ahead. POOKIE must be a functional, safe, intelligent AI agent before it gets wrapped into a desktop app.

---

### ➡️ Step 12: OS-Level Tool Registration & Agent Intelligence

**Prerequisites:** Step 11 fully complete.
**Goal:** Transform POOKIE from a chatbot into an actual OS-level AI agent.

#### 12.1: Core System Tools
**File:** `backend/core/agent/tools.py` (NEW FILE)

Register the following LangChain `@tool` functions:

| Tool | Function | Description | Permission |
|---|---|---|---|
| `open_application` | `subprocess.Popen()` | Opens any installed app by name (Chrome, VS Code, Notepad, etc.) | Level 2 |
| `run_shell_command` | `subprocess.run()` | Runs PowerShell/bash commands, returns stdout/stderr | Level 2 |
| `get_system_info` | `psutil` | Returns CPU %, RAM %, disk usage, battery, OS info | Level 1 (safe) |
| `get_current_time` | `datetime` | Returns current date/time (already exists — move here) | Level 1 |
| `control_volume` | `pycaw` (Win) / `amixer` (Linux) | Set, mute, or get system volume | Level 2 |
| `web_search` | DuckDuckGo API / SerpAPI | Searches the web and returns top results | Level 1 |

#### 12.2: File System Tools
**File:** `backend/core/agent/tools.py`

| Tool | Function | Description | Permission |
|---|---|---|---|
| `read_file` | `open().read()` | Reads contents of a local file by path | Level 2 |
| `write_file` | `open().write()` | Creates or overwrites a file at given path | Level 2 |
| `search_files` | `glob` / `os.walk` | Searches for files by name, extension, or pattern in a directory | Level 2 |
| `list_directory` | `os.listdir()` | Lists files and folders in a given directory | Level 2 |

#### 12.3: Command Safety Layer
**File:** `backend/core/agent/safety.py` (NEW FILE)

1. **Command Blacklist** — Block dangerous patterns before execution:
   - `rm -rf /`, `format`, `del /f /s /q`, `:(){ :|:& };:`, `mkfs`, `dd if=`, `shutdown`, `reg delete`
   - Regex-based matching for obfuscation attempts
2. **Path Sandboxing** — File tools can only access user home directory by default, never system directories (`C:\Windows`, `/etc`, `/usr/bin`)
3. **Output Sanitization** — Truncate tool output to 2000 chars max to prevent context window overflow

#### 12.4: Permission Enforcement Layer
**File:** `backend/core/agent/permissions.py` (NEW FILE)

Before any tool executes:
```python
def check_permission(user_id: str, required_level: int) -> bool:
    user = User.objects(user_id=user_id).first()
    if required_level == 1:
        return True  # Level 1 tools are always allowed
    if required_level == 2:
        return user.permissions.level_2_granted
    if required_level == 3:
        return False  # Level 3 always requires manual UAC prompt
```

If permission is denied, the tool returns: `"I don't have permission to do that. You can enable this in Settings > Permissions."`

#### 12.5: Command Logging
**File:** `backend/core/agent/models.py` (NEW FILE)

Create `CommandLog` MongoEngine model:
```python
class CommandLog(me.Document):
    log_id = me.StringField(default=lambda: str(uuid.uuid4()), unique=True)
    user_id = me.StringField(required=True)
    conversation_id = me.StringField(required=True)
    tool_name = me.StringField(required=True)       # e.g., "open_application"
    tool_input = me.StringField()                    # e.g., "chrome"
    tool_output = me.StringField()                   # e.g., "Chrome opened successfully"
    status = me.StringField(choices=["success", "denied", "error", "blocked"])
    executed_at = me.DateTimeField(default=datetime.now(timezone.utc))
    meta = { 'collection': 'command_logs', 'indexes': ['user_id', '-executed_at'] }
```

Every tool execution MUST create a log entry before returning.

#### 12.6: Agent Personality & System Prompt Refinement
**File:** `backend/core/agent/llm_agent.py`

Rewrite `self.system_prompt` with:
- Rich personality traits (friendly, witty, efficient)
- Awareness of available tools and when to use them
- Clear rules: never auto-run destructive commands, always confirm deletes
- Context about the user's OS and system capabilities
- Instruction to prefer tool calls over telling the user to do things manually

#### 12.7: Wire Tools into Agent
**File:** `backend/core/agent/llm_agent.py`

- Import all tools from `tools.py`
- Register in `self.tools = [open_application, run_shell_command, ...]`
- Pass `user_id` context through tool calls so permission checks work

---

### ⬜ Step 13: Reminders & Scheduled Tasks

**Prerequisites:** Step 12 complete.
**Goal:** Allow POOKIE to set reminders and schedule tasks.

#### 13.1: Reminder Model
**File:** `backend/core/tasks/models.py`

```python
class Reminder(me.Document):
    reminder_id = me.StringField(unique=True)
    user_id = me.StringField(required=True)
    title = me.StringField(required=True)
    description = me.StringField()
    remind_at = me.DateTimeField(required=True)
    status = me.StringField(choices=["pending", "fired", "cancelled"], default="pending")
    created_at = me.DateTimeField(default=datetime.now(timezone.utc))
```

#### 13.2: Reminder API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/reminders/` | `GET` | List user's reminders |
| `/api/v1/reminders/` | `POST` | Create a new reminder |
| `/api/v1/reminders/{id}/` | `DELETE` | Cancel a reminder |

#### 13.3: Reminder Tool
Register a `set_reminder` LangChain tool so the agent can create reminders from natural language:
- "Remind me to call mom at 6 PM" → parses time → creates Reminder document

#### 13.4: Celery Beat Scheduler
Use `celery-beat` to check for due reminders every 30 seconds and push a WebSocket notification to the user's active session.

---

### ⬜ Step 14: OAuth Integration

**Prerequisites:** Step 13 complete.
**Goal:** Add Google and GitHub OAuth login so users don't need manual email/password registration.

#### 14.1: Google OAuth Setup
- Register OAuth app in Google Cloud Console
- Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`
- Configure `SOCIALACCOUNT_PROVIDERS` in `settings.py`
- Create `/api/v1/auth/google/` endpoint using `dj-rest-auth`

#### 14.2: GitHub OAuth Setup
- Register OAuth app in GitHub Developer Settings
- Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `.env`
- Create `/api/v1/auth/github/` endpoint

#### 14.3: Frontend OAuth Buttons
**File:** `frontend/src/components/Login.tsx`
- Add "Continue with Google" and "Continue with GitHub" buttons above the email form
- On success, receive JWT token → store in Zustand → redirect to onboarding/dashboard
- Keep the manual email/password option as a fallback

---

### ⬜ Step 15: Full-Stack Refinement

**Prerequisites:** Step 14 complete.
**Goal:** Polish every aspect of the frontend and backend for a premium, production-quality experience.

#### 15.1: Frontend Cleanup
- **Remove dead UI:** Remove or repurpose the "Images" tab (currently does nothing)
- **Settings Page:** Create a `/dashboard/settings` view with:
  - Permission toggles (Level 2 on/off)
  - Theme/accent color picker
  - Barge-in sensitivity slider
  - Logout button
- **Skeleton Loading Screens:** Add shimmer placeholders while data loads
- **Error Boundaries:** Wrap major sections in React error boundaries with graceful fallback UI
- **Real Microphone Test:** Wire the onboarding mic test to actually capture audio and visualize waveform

#### 15.2: Backend Refinement
- **Fix Bug B4:** Verify `RefreshToken` creation uses `.save()` not `.objects.create()`
- **Optimize Queries:** Add missing indexes, ensure no N+1 queries
- **Rate Limiting:** Add throttling to auth endpoints (prevent brute force)
- **Input Validation:** Sanitize all user inputs in serializers (max lengths, allowed characters)
- **Logging:** Add structured Python logging (replace all `print()` with `logging.info/warning/error`)

#### 15.3: Agent Intelligence Tuning
- Test agent with 50+ diverse commands and refine system prompt based on failure patterns
- Add conversation context window management (trim old messages to prevent token overflow)
- Improve tool selection accuracy with few-shot examples in system prompt

---

### ⬜ Step 15.5: Security Audit

**Prerequisites:** Step 15 complete.
**Goal:** Harden POOKIE against real-world attack vectors before packaging.

#### Security Checklist:
1. **CORS Lock-down:** Replace `CORS_ALLOW_ALL_ORIGINS = True` with explicit whitelist (`localhost:5173`, `localhost:5174`)
2. **Prompt Injection Testing:** Test 20+ prompt injection attacks against the agent and verify the system prompt holds
3. **Command Blacklist Validation:** Attempt to bypass the safety layer with encoded/obfuscated commands
4. **Level 3 UAC Prompts:** Implement OS-level confirmation dialogs for admin actions (Windows UAC / Linux polkit)
5. **Dependency Audit:** Run `safety check` (Python) and `npm audit` (Node) — fix all critical/high vulnerabilities
6. **JWT Security:** Verify token expiration, rotation, and revocation logic works correctly
7. **WebSocket Authentication:** Verify unauthenticated connections are rejected with code 4001
8. **File Path Traversal:** Test that `read_file`/`write_file` tools cannot escape the sandboxed directory

---

### ⬜ Step 16: Electron Desktop Integration

**Prerequisites:** Steps 12–15.5 ALL complete. POOKIE must be a fully functional, secure agent before packaging.

**Tasks:**
1. Install: `npm install electron electron-builder --save-dev`
2. Create `frontend/electron/main.js` — BrowserWindow config (transparent, frameless, always-on-top option)
3. Add `package.json` scripts: `"electron": "electron ."`, `"build:electron": "vite build && electron-builder"`
4. System tray: `Tray` + `Menu` from Electron — icon, "Open POOKIE", "Quit"
5. Global hotkey: `globalShortcut.register('Alt+Space', ...)` — show/hide main window
6. `electron-builder` config: Windows NSIS target, Linux AppImage target
7. Auto-start backend services (Daphne + Celery + Redis) when Electron launches

---

### ⬜ Step 17: Custom Wake Word — "Hey Pookie"

**Prerequisites:** Step 16 (Electron) complete. Wake word only works inside the desktop app — browsers cannot have always-on microphone access.
**Goal:** Say "Hey Pookie" to activate the Electron app from anywhere on your desktop.

#### 17.1: Collect Training Data
- Record 50+ positive samples of "Hey Pookie" in different voices, tones, speeds
- Record 200+ negative samples (random speech, background noise, similar-sounding words)
- Use OpenWakeWord's data format requirements

#### 17.2: Train the Model
- Use OpenWakeWord's fine-tuning pipeline
- Export `.onnx` model file → save to `backend/core/wake_word/models/hey_pookie.onnx`

#### 17.3: Integrate into Detector
**File:** `backend/core/wake_word/detector.py`
- Replace `wakeword_models=['hey_jarvis']` with `wakeword_models=['path/to/hey_pookie.onnx']`
- Update detection threshold if needed
- Fix Bug B1: Change print string from "Hey Jarvis" to "Hey Pookie" in `listener.py`

#### 17.4: Wire Wake Word into Electron
- Run wake word detector as a background thread inside Electron's main process
- On detection: bring POOKIE window to foreground → auto-activate microphone → begin listening
- Add wake word sensitivity slider to Settings page

---

## PHASE 4: Mobile App (Android) ⬜ PENDING

### Step 18: React Native Setup
**Prerequisites:** Phase 3.5 fully complete, Electron app packaged.

Do not start until Phase 3.5 is complete.

### Step 18.5: Firebase & Mobile Permissions
Android Foreground Service, Firebase FCM push notifications, Accessibility Services.

---

## PHASE 5: Packaging & Deployment ⬜ PENDING

### Step 19: Packaging & Deployment
1. Dockerize: Django + Celery + Redis + MongoDB via Docker Compose
2. `electron-builder` → `.exe` (Windows) + `.AppImage` (Linux)
3. Landing page with GSAP + ScrollTrigger

---

## PHASE 6: Vanguard Features ⬜ PENDING

### Step 20: Cross-Device Spatial Handoff
mDNS discovery, peer-to-peer WebSocket mesh, context migration payload

### Step 21: On-Screen Context Awareness
`mss` screen capture → local OCR/VLM (Florence-2/Tesseract) → zero-retention policy

### Step 22: Algorithmic Personalization
`user_lore` collection, adaptive system prompts, Visual DNA Orb shader seed

---

## HOW TO RUN LOCALLY

### Backend Services (run in 3 separate terminals)
```bash
# Terminal 1: Django ASGI Server
cd backend
venv\Scripts\activate
python manage.py runserver  # or: daphne pookie.asgi:application

# Terminal 2: Celery Worker
cd backend
venv\Scripts\activate
celery -A pookie worker --loglevel=info --pool=solo

# Terminal 3 (optional): Local Voice Loop
cd backend
venv\Scripts\activate
python listener.py
```

### Frontend Dev Server
```bash
cd frontend
npm run dev
# Open: http://localhost:5173
```

### Required Services (must be running)
- **MongoDB:** `mongod` on port 27017
- **Redis:** `redis-server` on port 6379

### Environment Variables (`backend/.env`)
```env
NVIDIA_API_KEY=your_nvidia_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```
