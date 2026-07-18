# Setu — Master Implementation Guide

> **AI RULE:** This is the strict execution order. Never skip ahead. Always check status markers before writing any code.
> **MVP Deadline: July 20, 2026 | Team: 3 people | Budget: ₹0**

---

## STATUS LEGEND

- ✅ **COMPLETED** — Code exists and verified working
- ⚠️ **PARTIAL** — Code exists but has known gaps
- ➡️ **NEXT** — Immediate next task
- ⬜ **PENDING** — Not started, do not touch yet
- 🚫 **SKIP** — Deprioritized, not part of Setu MVP

---

## KNOWN BUGS

All bugs B1–B8 are **✅ RESOLVED**.
Additionally, the deep codebase audit and UI bugs identified on June 22, 2026 are **✅ RESOLVED**:
- **BUG-9 (Backend Model Stale Defaults):** Corrected `ai_provider` choices, `llm_model` defaults, and wake word sensitivity settings (0.5 → 0.06).
- **BUG-10 (DRF Auth Mismatch):** Fixed DRF authentication class configuration to match custom `PyJWTAuthentication` instead of standard simple_jwt.
- **BUG-11 (Front-End QueryClient Build Break):** Removed unused `@tanstack/react-query` import and wrapper to fix TypeScript build error.
- **BUG-12 (Wake Word Detector Crash):** Added `exception_on_overflow=False` in `detector.py` to prevent buffer overflows from crashing the wake word thread.
- **BUG-13 (Shell Injection / URL Truncation):** Hardened OS-level web launcher tool using Python's standard `webbrowser` library.
- **BUG-14 (TTS/Synthesis Latency UI Block):** Refactored UI state flags to prevent input/recording overlap and correctly track async Kokoro TTS audio generation.
- **BUG-15 (Task Stream Parser & History Accordion):** Updated parser to recognize `'agent'` message roles and added expandable session history cards.

Additionally, the deep pipeline latency optimizations on July 19, 2026 are **✅ RESOLVED**:
- **BUG-16 (Cold Start Penalty):** Moved ML singletons into Django AppConfig for boot-time loading.
- **BUG-17 (TTS Streaming Block):** Implemented sentence-by-sentence parallel audio generation and frontend playback queuing.
- **BUG-18 (WebSocket Disk I/O):** Replaced `.webm` temporary files with pure `io.BytesIO` memory buffers.
- **BUG-19 (O(N) SQLite Overhead):** Refactored `_heal_checkpoint` to perform an O(1) peek instead of scanning all historical states.
- **BUG-20 (MongoDB Read/Write Bloat):** Utilized atomic `$push` operations for message history appending.
- **BUG-21 (Playwright RAM Bloat):** Restructured browser automation to share a single Chromium instance with lightweight contexts.
- **BUG-22 (Double TTS Pipeline Memory Waste):** Implemented lazy loading for Kokoro language pipelines.

---

## PHASE 1: Core AI & Local Inference Foundation ✅ COMPLETED

### Step 1: Backend Environment ✅
- Python 3.11 venv, Django 6.0.5, all libraries in `requirements.txt`
- Apps: `core.users`, `core.conversations`, `core.agent`, `core.websockets`

### Step 2: Wake Word Detection ✅
- **File:** `backend/core/wake_word/detector.py`
- OpenWakeWord with `hey_jarvis` proxy model (custom "Hey Setu" model → Step 20)
- Silero VAD for end-of-speech detection
- `listen_for_wake_word()` → blocks until score > 0.06
- `capture_audio_dynamic()` → records 16kHz mono float32 until 700ms silence or 15s timeout

### Step 3: Speech-to-Text ✅
- **File:** `backend/core/ai/stt.py`
- Faster-Whisper `small.en`, `int8`, CPU device
- `transcribe(audio_data)` → returns stripped string
- ⚠️ **Note:** Model must be swapped to multilingual in Step 14

### Step 4: LangGraph Agent Brain ✅
- **File:** `backend/core/agent/llm_agent.py`
- `SetuAgent` class with 3-layer resilience:
  - Layer 1: `InMemoryCache` — identical queries cached (→ replace with Redis in Step 16)
  - Layer 2: Tenacity `@retry` — exponential backoff (1s, 2s, 4s)
  - Layer 3: Primary `ChatNVIDIA` → Secondary `OpenRouter` → Tertiary `Gemini-2.5-Flash`
- LangGraph `create_react_agent` with `MemorySaver` checkpointer
- Agent loaded as module-level singleton in `tasks.py`
- XML/tool-tag scrubbing via `re.sub` before returning text

### Step 5: Text-to-Speech ✅
- **File:** `backend/core/ai/tts.py`
- Kokoro `KPipeline(lang_code='a')`, voice: `af_heart`
- `speak(text)` — plays locally via sounddevice at 24kHz
- `generate_base64(text)` — generates WAV, encodes to base64 for WebSocket streaming
- ⚠️ **Note:** Voice selection (male/female/Hindi) to be added in Step 14

### Step 5.1: Main Listener Loop ✅
- **File:** `backend/listener.py`
- Full voice pipeline: WakeWord → STT → Agent → TTS
- Exit words: `["no", "nope", "bye", "goodbye", "thanks", "stop", "nothing"]`

---

## PHASE 2: Web API, Database & Real-Time Sync ✅ COMPLETED

### Step 6: MongoDB Architecture ✅
- MongoEngine connected in `settings.py` (`setu_db` on `localhost:27017`)
- Collections: `users`, `conversations`, `refresh_tokens`, `command_logs`
- All core models implemented

### Step 6.5: Database Indexes ✅
- `users`: `email` (unique), `user_id` (unique)
- `conversations`: `conversation_id` (unique), `(user_id, -started_at)` compound
- `refresh_tokens`: `expires_at` (TTL=0), `token_hash` (unique)
- `command_logs`: `(user_id, -executed_at)` compound, TTL 90 days

### Step 7: Auth & Security ✅
- `generate_tokens()` — HS256 JWT (15min access, 7-day refresh)
- `PyJWTAuthentication` — validates Bearer token on every protected request
- `RefreshView` — rotates refresh tokens
- `RegisterView`, `LoginView` — local auth (to be replaced by OAuth in Step 13)

### Step 8: REST Endpoints ✅
- All core endpoints implemented (see `AI_CONTEXT.md` API Reference)

### Step 8.5: WebSockets & Background Streams ✅
- `backend/setu/asgi.py` — `ProtocolTypeRouter` separates HTTP and WS
- `JwtAuthMiddleware` — validates token from query param before accepting WS
- `AgentStreamConsumer` — joins `chat_{conversation_id}` channel group
- `process_agent_command` background task thread — streams word-by-word, generates TTS base64
- Channel Layer: In-memory Channel Layer (Celery & Redis removed for simplification)

---

## PHASE 3: Desktop Dashboard & Frontend ✅ COMPLETED

### Step 9: React Frontend Setup ✅
- React 18 + Vite + JavaScript + TailwindCSS (TypeScript migrated to pure JS)
- `App.jsx` — routes `/`, `/auth`, `/onboarding/*`, `/dashboard/*`
- `NeuralMesh.jsx` — canvas-based physics particle background
- `Login.jsx` — glassmorphic card wired to `/api/v1/auth/login/`

### Step 10: Onboarding UI ✅
- **File:** `frontend/src/pages/Onboarding.tsx`
- 4-step wizard: Name → Mic Test → Permissions + EULA → Done
- Framer Motion transitions between steps ✅
- 🚫 **Note:** 8-step expansion skipped for simplified MVP (kept 4-step wizard)

### Step 11: Connect UI to Backend ✅
- All B3–B8 bugs fixed
- Zustand store `useAppStore.js` with token, username, conversationId, eulaAccepted
- React Query removed to fix build break; using native fetch / React state wrapping `main.jsx`

### Step 12: OS-Level Tool Registration & Agent Intelligence ✅
- **File:** `backend/core/agent/tools.py`
  - System: `open_application`, `run_shell_command`, `get_system_info`, `get_current_time`, `control_volume`, `web_search`
  - File: `read_file`, `write_file`, `search_files`, `list_directory`
- **File:** `backend/core/agent/safety.py` — blacklist, path sandboxing, output truncation
- **File:** `backend/core/agent/permissions.py` — `check_permission(user_id, required_level)`
- **File:** `backend/core/agent/models.py` — `CommandLog` MongoEngine model with TTL index

---

## PHASE 3.5: Dashboard Structural Overhaul ✅ COMPLETED
*Goal: Realign the frontend React architecture to the final design specs before diving into deep backend logic.*

### ✅ Step 12.5: Task Dashboard UI Overhaul

**Prerequisites:** Step 12 complete.

**File:** `frontend/src/pages/Dashboard.tsx`

Replace chat-centric UI with task dashboard layout.
- **Task Feed:** Renders task steps, progress, command input bar.
- **Utility Sidebar:** Settings, Devices, Memory, and Contacts UI shells complete.

---

## PHASE 4: Setu MVP Sprint 🔴 DEADLINE: JULY 20, 2026

> This phase has been simplified into 4 targeted milestones:
> - **Phase 0:** TS to JS clean up ✅ (Completed)
> - **Phase 4A:** Identity, Voices, Reminders & Fallbacks ✅ (Completed)
> - **Phase A:** Playwright Browser Automation (Days 2-4) ➡️ (Next)
> - **Phase B:** Phone PWA + Voice (Days 5-7) ⬜
> - **Phase C:** Polish & Demo (Days 8-10+) ⬜

---

### PHASE 4A: Identity, Voices & Reminders (Milestone 1) - COMPLETED
*Goal: Secure user authentication, Hindi/English STT/TTS setup, and reminder scheduling.*

---

### Step 13: OAuth Integration (Google + GitHub) ✅

**Why first:** Everything downstream (cross-device, multi-user data isolation) requires real user identity.

#### 13.1: Backend — OAuth Endpoints
**Files:** `backend/core/users/views.py`, `backend/core/users/auth.py`

```python
# POST /api/v1/auth/google/
# Body: { "id_token": "<Google ID token from frontend>" }
# → Verify token with Google API → find or create User → return JWT pair

# POST /api/v1/auth/github/
# Body: { "code": "<GitHub OAuth code from frontend>" }
# → Exchange code for access token → fetch GitHub user → find or create User → return JWT pair
```

- User `auth_provider` = `"google"` or `"github"`
- `password_hash` = `null` always
- On first login → set `is_active=True`, create default preferences

#### 13.2: Environment Variables
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

#### 13.3: Frontend — OAuth Buttons
**File:** `frontend/src/components/Login.tsx`
- "Continue with Google" → Google OAuth2 popup → receive `id_token` → POST to `/api/v1/auth/google/`
- "Continue with GitHub" → redirect to GitHub OAuth → receive `code` → POST to `/api/v1/auth/github/`
- On success: store JWT in Zustand → redirect to `/onboarding` (first time) or `/dashboard`

#### 13.4: URL Registration
**File:** `backend/setu/urls.py`
```python
path('api/v1/auth/google/', GoogleOAuthView.as_view()),
path('api/v1/auth/github/', GitHubOAuthView.as_view()),
```

---

### ✅ Step 13.2: User Settings & Sandbox Unification (Gaps Fix)

**Why now:** Unify preferences schema and sandboxing logic between UI and backend.

#### 13.2.1: Add Missing Preference Fields in DB
- **Files:** `backend/core/users/models.py`, `backend/core/users/serializers.py`
- Add `tts_voice_gender` (String), `screenshot_preference` (String), and `trust_mode` (Boolean) to `UserPreferences` model and `UserPreferencesSerializer`.
- Add `whitelisted_paths` (List of Strings) to user preferences.

#### 13.2.2: Sandbox Whitelist Verification
- **File:** `backend/core/agent/safety.py`
- Update `is_path_allowed(target_path, user_id)` to load preferences for the user.
- Allow file tool operations if path is inside `Path.home()` OR is a subpath of any path listed in `whitelisted_paths` (provided it's not a blocked system folder).
- Map whitelist settings panel changes in `Dashboard.tsx` to update `/api/v1/user/profile/`.

---

### ✅ Step 13.5: Reminders & Scheduled Tasks

**Files:** `backend/core/tasks/views.py`, `backend/core/tasks/serializers.py`, `backend/core/agent/tools.py`
- Create `ReminderSerializer` and CRUD views for `Reminder` MongoEngine model.
- `@tool` `set_reminder` registered and parses time string using `dateparser.parse()`.
- Daemon thread scheduler scans `check_reminders` every 30s and streams `chunk_type: "reminder"` to user via channels.
- Frontend reminders widget fully integrated with active listing/deletion in `Dashboard.jsx`.

---

### ✅ Step 14: Multilingual STT + TTS Voice Selection

**Prerequisites:** Step 13.5 complete.

#### 14.1: STT Model Swap ✅
**File:** `backend/core/ai/stt.py`
- Change `WhisperModel('small.en')` → `WhisperModel('small')` (multilingual)
- Auto-detect language from transcription result
- Pass detected language code to TTS for matching voice selection

#### 14.2: TTS Voice & Speed Integration ✅
**File:** `backend/core/ai/tts.py`
- Update `TTSEngine` to accept `voice` and `speed` dynamically:
  - English Female: `KPipeline(lang_code='a')`, voice `af_heart`
  - English Male: `KPipeline(lang_code='a')`, voice `am_echo`
  - Hindi Female: `KPipeline(lang_code='h')`, voice `hf_alpha`
  - Hindi Male: `KPipeline(lang_code='h')`, voice `hm_omega`
- Background thread `process_agent_command` reads `user.preferences.language` and `tts_voice_gender` before calling `generate_base64()`.

#### 14.3: Real Token Streaming (WebSocket) ✅
- **File:** `backend/core/agent/tasks.py`
- Replace fake splits/loops with a LangGraph message stream that pushes chunks over the channel layer in real time.

#### 14.4: Hardware-Adaptive STT Auto-Detection & Unloading ✅
- **File:** `backend/core/ai/stt.py`
- Detect host RAM (>=12GB loads `large-v3-turbo`, otherwise `small`).
- Integrate explicit `del model` and `gc.collect()` routines to free memory when switching models.
- Apply bilingual prompts and VAD tuning.


---

### ✅ Step 14.5: Local Listener & Audit Logs Hookup

#### 14.5.1: Local Listener Permission Bypass
- **File:** `backend/core/agent/permissions.py`
- Add an exception in `check_permission` for `user_id == "local"` to return `True` for Level 2 commands. Allows terminal-based `listener.py` voice triggers to control the desktop without database auth checks.

#### 14.5.2: Audit Logs Endpoint
- **Files:** `backend/core/agent/views.py`, `backend/setu/urls.py`
- Create `CommandLogListView` to return real command execution logs for the current user.
- Connect TanStack query in `Dashboard.jsx` settings/permissions audit logs panel.

---

### ✅ Step 14.6: Speed Optimizations (Tier 0 Fast-Path + TTS Cache) - COMPLETED

**Prerequisites:** Step 14.5 complete.

**Purpose:** Make Setu feel instant for common interactions. Greetings, farewells, and simple queries should respond in < 0.3s instead of 4–10s. This is the first layer of the 3-tier response architecture — Tier 1 (Intent Classifier) comes in Step 15.

#### 14.6.1: Tier 0 — Instant Response Router
**New File:** `backend/core/agent/fast_responses.py`

Regex/keyword matcher that intercepts commands **before** the LLM pipeline. Returns a pre-defined response for trivial interactions.

Pattern categories:
- `GREETING` — "hi", "hello", "hey", "hey setu", "good morning", "namaste", "kaise ho"
- `FAREWELL` — "bye", "goodbye", "see you", "good night", "alvida"
- `THANKS` — "thanks", "thank you", "appreciate it", "shukriya", "dhanyavaad"
- `HOW_ARE_YOU` — "how are you", "how're you doing", "kaise ho", "kya haal hai"
- `WHAT_ARE_YOU` — "what are you", "who are you", "what can you do"
- `CANCEL` — "cancel", "stop", "never mind", "forget it", "rehne de"

```python
class FastResponseRouter:
    def check(self, text: str, user_name: str = None) -> Optional[FastResponse]:
        # Returns FastResponse(text, category) or None
        # Responses are personalized with user's name
        # Supports English, Hindi, and Hinglish patterns
```

#### 14.6.2: Pre-cached TTS Audio Bank
**New File:** `backend/core/agent/tts_cache.py`

Pre-generate TTS audio for ~20–30 common Tier 0 responses and cache in memory.

- Cached per voice variant (af_heart, am_echo, hf_alpha, hm_omega)
- Built lazily on first use per voice (not all 4 at startup)
- Stored as `{ "response_text": "base64_audio_wav" }` in a dict
- Total memory: ~2–3 MB per voice

```python
class TTSCache:
    def get_or_generate(self, text: str, voice: str, tts_engine: TTSEngine) -> str:
        # Returns base64 audio — from cache if available, else generates and caches
```

#### 14.6.3: Instant Acknowledgment
- **WebSocket path** (`consumers.py`): Push `chunk_type: "status"` with `"acknowledged"` immediately on message receive — before processing dispatch.
- **Listener path** (`listener.py`): Play short spoken cue ("On it!" / "Let me check...") while LLM processes complex commands.
- **Impact:** User knows Setu heard them within ~200ms.

#### 14.6.4: Streaming TTS (Sentence-by-Sentence)
**File:** `backend/core/ai/tts.py`, `backend/core/agent/tasks.py`

Instead of generating TTS for the entire response as one block:
1. Split response text into sentences after LLM streaming completes.
2. Generate TTS for the first sentence → stream to client immediately.
3. Generate remaining sentences → stream as they complete.

```python
def generate_base64_streaming(self, text: str, voice: str, speed: float) -> Generator[str, None, None]:
    # Yields base64 audio chunks, one per sentence
```

**Impact:** User hears first words ~0.3s after text is ready, instead of waiting 1–2s for full audio.

#### 14.6.5: User Preference Cache
**File:** `backend/core/agent/tasks.py`

Cache user name + voice preferences in a module-level dict to avoid MongoDB lookups on every command.

```python
_user_pref_cache = {}  # { user_id: { "name": ..., "voice": ..., "speed": ..., "lang": ..., "cached_at": ... } }
# TTL: 5 minutes. Refreshed on cache miss or expiry.
```

#### 14.6.6: Pipeline Integration

**In `tasks.py` (WebSocket path):**
```python
fast = fast_router.check(text, user_name=cached_prefs.name)
if fast:
    _push(group, 'text', fast.text)
    _push(group, 'audio', tts_cache.get_or_generate(fast.text, voice))
    _push(group, 'status', 'done')
    return True
# else → existing LLM pipeline
```

**In `listener.py` (Voice loop path):**
```python
fast = fast_router.check(text_command, user_name="User")
if fast:
    tts.speak(fast.text, voice=voice)  # or play from cache
    continue
# else → existing agent.run() pipeline
```

#### Expected Impact

| Scenario | Before | After |
|---|---|---|
| "Hey Setu" / "Hi" / "Namaste" | 4–10s | **< 0.3s** |
| "Thanks" / "Bye" / "Shukriya" | 4–10s | **< 0.3s** |
| Complex command (first word heard) | 4–10s | **3–8s** (ack + streaming TTS saves ~1–2s) |

---

### PHASE 4B: Local Efficiency & Cache (Milestone 2)
*Goal: Skipped for MVP. Direct routing to LLM is used instead to avoid ONNX/PyTorch overhead, and memory-backed channels replace Redis.*

---

### 🚫 SKIP (MVP): Step 15: Intent Pre-Classifier (PyTorch)

**Prerequisites:** Step 14 complete.

**Purpose:** Classify commands BEFORE hitting the LLM. Saves 60–70% of API calls.

#### 15.1: Train Classifier
**File:** `ai/intent_classifier/train.py`

Classes:
- `OPEN_APP_LAPTOP` — "Open Chrome", "Launch VS Code"
- `OPEN_APP_PHONE` — "Open Instagram on my phone", "Open YouTube"
- `SYSTEM_INFO` — "What's my battery?", "What time is it?"
- `REPEAT_LAST` — "Do that again", "Repeat"
- `TIME_DATE` — "What time is it?", "What's today's date?"
- `COMPLEX_TASK` — Everything else → send to LLM

Training data: ~200 examples per class. Use DistilBERT fine-tuning or a simple LSTM.
Export to ONNX: `ai/intent_classifier/hey_setu_intent.onnx`

#### 15.2: Inference Integration
**File:** `backend/core/ai/classifier.py`
```python
class IntentClassifier:
    def __init__(self): # Load ONNX model once at startup
    def classify(self, text: str) -> str: # Returns intent class string
```

#### 15.3: Agent Pipeline Integration
**File:** `backend/core/agent/tasks.py`
```python
intent = classifier.classify(user_command)
if intent in DIRECT_EXECUTION_INTENTS:
    result = execute_direct(intent, user_command)  # No LLM
else:
    result = agent.invoke(user_command)  # Full LLM pipeline
```

---

### 🚫 SKIP (MVP): Step 16: Reliability Architecture (Redis Semantic Cache + Hardening)

**Prerequisites:** Step 15 complete.

#### 16.1: Redis Semantic Cache
**File:** `backend/core/agent/cache.py`
- Replace `InMemoryCache` with Redis-backed semantic cache
- Use sentence-transformers (`all-MiniLM-L6-v2`) to embed queries
- Cache key = cosine similarity search in Redis (threshold: 0.92)
- "Open Chrome" / "Launch Chrome" / "Start Chrome" → same cache entry
- TTL: 1 hour for cached results

#### 16.2: Context Window Compression
**File:** `backend/core/agent/context.py`
- Keep last 5 messages in full
- Older messages → summarize into 1 line via fast LLM call → store in MongoDB with `compressed: true`
- Inject summary + last 5 into system prompt

#### 16.3: Proactive Rate Limit Routing
**File:** `backend/core/agent/llm_agent.py`
- Track API call count per provider in Redis (rolling 60-second window)
- If primary provider hits 80% of limit → route to secondary before failure
- Zero failures, zero retries wasted

#### 16.4: Request Deduplication
**File:** `backend/core/agent/tasks.py`
- Hash command text + user_id + 10-second timestamp window
- Store hash in Redis with 10-second TTL
- If duplicate: return in-progress result instead of new LLM call

#### 16.5: Graceful Degradation
If all providers fail:
```
"I'm having a little trouble right now. Your command is queued — I'll retry in 30 seconds."
```
- Store command in Redis queue → auto-retry via Celery

---

### PHASE 4C: Cross-Device Protocol & Peer Pairing (Milestone 3)
*Goal: Skipped for MVP. Simple WebSocket connection to phone replaces custom ECDH pairing.*

---

### 🚫 SKIP (MVP): Step 17: Cross-Device Protocol (LAN WebSocket)

**Prerequisites:** Step 16 complete.
**This is the core Setu feature.**

#### 17.1: mDNS Advertiser (Laptop Side)
**File:** `backend/core/cross_device/mdns.py`
- Use `zeroconf` library to register service `_setu-sync._tcp.local.`
- TXT records: `device_id`, `friendly_name`, `os`, `pairing_status`
- Start advertising when Django starts (add to `apps.py` `ready()` hook)

#### 17.2: Pairing Logic
**File:** `backend/core/cross_device/pairing.py`
- Generate 6-digit PIN on laptop
- ECDH key exchange → derive AES-256 session key + HMAC key using HKDF
- Store `DevicePairing` document in MongoDB (store HMAC of session key, not raw)
- PIN expires after 5 minutes

#### 17.3: Cross-Device WebSocket Consumer
**File:** `backend/core/cross_device/consumers.py`
```python
class CrossDeviceConsumer(AsyncWebsocketConsumer):
    # ws://laptop_ip:8000/ws/device/{device_id}/?token=<jwt>
    # Receives command from phone → validates JWT + pairing → routes to agent
    # Streams back result + optional screenshot
```

#### 17.4: DevicePairing Model
**File:** `backend/core/cross_device/models.py`
- See `DATABASE_SCHEMA.md` §2.5 for full schema

#### 17.5: REST Endpoints
```python
# POST /api/v1/devices/pair/     → initiate pairing, returns PIN
# GET  /api/v1/devices/          → list paired devices
# DELETE /api/v1/devices/{id}/   → revoke pairing
```

#### 17.6: Security Checks
- Reject connections from outside local subnet (`request.META['REMOTE_ADDR']`)
- Timestamp + nonce replay prevention (Redis, 10-second TTL)
- All phone commands pass through same `safety.py` blacklist

---

### PHASE 4D: Laptop Automation Engine (Milestone 4)
*Goal: Integrate Playwright browser automation, pywinauto native desktop control, confirmation flows, and screen capture streaming.*
*Git Action: Commit and push to GitHub upon completing Step 21.*

---

### ✅ Step 18: Browser Automation (Playwright)

**Prerequisites:** Phase 0 clean up complete.

#### 18.1: Install & Setup
```bash
pip install playwright
playwright install chromium
```

#### 18.2: Browser Tools
**File:** `backend/core/agent/tools.py` — add:
```python
@tool
def navigate_browser(url: str) -> str:
    """Open browser and navigate to URL."""

@tool
def click_element(selector: str) -> str:
    """Click a CSS selector or text on the current page."""

@tool
def type_into_field(selector: str, text: str) -> str:
    """Type text into a form field."""

@tool
def get_page_content() -> str:
    """Get the visible text content of the current page."""

@tool
def submit_form(selector: str = "form") -> str:
    """Submit a form on the current page."""
```

#### 18.3: Playwright Session Management
**File:** `backend/core/agent/browser.py`
- Single persistent `BrowserContext` per user session
- Async Playwright inside background tasks thread using `asyncio.run()`
- Auto-close browser after 5 minutes of inactivity

#### 18.4: Agent System Prompt Update
- Add browser tools to system prompt examples
- "Open Chrome and go to YouTube" → `navigate_browser("https://youtube.com")`

---

### 🚫 SKIP (MVP): Step 19: Desktop Automation (pywinauto)

**Prerequisites:** Step 18 complete.

#### 19.1: Install
```bash
pip install pywinauto
```

#### 19.2: Desktop Tools
**File:** `backend/core/agent/tools.py` — add:
```python
@tool
def find_window(app_name: str) -> str:
    """Find an open application window by name."""

@tool
def click_desktop_element(window_title: str, element_text: str) -> str:
    """Click a button or element in a native desktop app."""

@tool
def type_into_desktop_field(window_title: str, field_name: str, text: str) -> str:
    """Type into a field in a native desktop app."""
```

#### 19.3: Permission Gate
- All pywinauto tools require `level_2_granted = True`
- Check via `check_permission(user_id, required_level=2)` before execution

---

### 🚫 SKIP (MVP): Step 20: Task Plan Confirmation Flow

**Prerequisites:** Step 19 complete.

#### 20.1: Plan Generation
**File:** `backend/core/agent/planner.py`
- For commands that resolve to 2+ tool calls → generate plan before executing
- Format:
```json
{
  "plan": [
    {"step": 1, "action": "Open Chrome", "tool": "open_application"},
    {"step": 2, "action": "Navigate to YouTube", "tool": "navigate_browser"}
  ],
  "requires_confirmation": true
}
```

#### 20.2: WebSocket Plan Event
- Stream `chunk_type: "plan"` with plan JSON to frontend before execution
- Frontend shows plan with `[Proceed] [Cancel]` buttons
- Wait for user response via WebSocket message
- `trust_mode: true` in preferences → skip confirmation for standard tasks

#### 20.3: Single-Step Commands
- Single-step commands (e.g., "Open Chrome") → execute immediately, no confirmation

---

### 🚫 SKIP (MVP): Step 21: Screenshot Feedback System

**Prerequisites:** Step 20 complete.

#### 21.1: Screenshot Capture
**File:** `backend/core/agent/tools.py` — add:
```python
@tool
def capture_screenshot() -> str:
    """Capture the current laptop screen. Returns base64-encoded PNG."""
    # Uses mss library. Compress to 70% JPEG quality before encoding.
    # Buffer purged immediately after encoding — not stored to disk.
```

#### 21.2: Stream to Phone
- After each significant task step, check user's `screenshot_preference`
- `always` → auto-capture and stream via WebSocket
- `ask` → send `chunk_type: "screenshot_prompt"` → user confirms on phone
- `never` → skip entirely

#### 21.3: Screenshot Not Stored
- Screenshot bytes exist only in memory during encoding
- Never written to disk, never stored in MongoDB
- Sent as base64 in WebSocket frame only

---

### PHASE 4E: Memory Integration (Milestone 5)
*Goal: Build user profile memory manager, contacts list, and natural language command repeat logic.*
*Git Action: Commit and push to GitHub upon completing Step 22.*

---

### 🚫 SKIP (MVP): Step 22: Persistent Memory & Contacts Store

**Prerequisites:** Post-MVP. Memory and Contact database collections are skipped. Repeats are handled via LLM session history/context or standard frontend cache.

---

### PHASE 4F: Onboarding & Dashboard UI Overhaul (Milestone 6)
*Goal: Overhaul the onboarding wizard to 8 steps and transform the laptop dashboard UI from chat-centric to task-centric.*
*Git Action: Commit and push to GitHub upon completing Step 25.*

---

### 🚫 SKIP (MVP): Step 23: Onboarding Wizard Upgrade (8 Steps)

**Prerequisites:** Kept the current glassmorphic 4-step wizard to reduce complexity. No modifications to onboarding steps needed.

---

### ➡️ NEXT: Phase B: Mobile Client Integration (PWA)

**Prerequisites:** Phase A complete. Replaces React Native with a lightweight Progressive Web App (PWA).

#### 24.1: PWA Manifest & Service Worker
- Create `frontend/public/manifest.json` and `frontend/public/sw.js` for home screen installable PWA.
- Expose big tap-to-talk mic button on mobile view.

#### 24.2: Web Audio API mic recording on Phone
- Capture audio directly from the phone browser, encode to base64, and stream over WebSocket to the Django backend.
- Receive transcription and response back dynamically.

---

## PHASE 5: Custom Wake Word ⬜ POST-MVP

### Step 26: "Hey Setu" Wake Word Training
**Prerequisites:** All Phase 4 steps complete.

1. Record 50+ "Hey Setu" samples + 200+ negative samples
2. Train via OpenWakeWord fine-tuning pipeline
3. Export `.onnx` → `backend/core/wake_word/models/hey_setu.onnx`
4. Replace `wakeword_models=['hey_jarvis']` with custom model path
5. Wire to Electron main process background thread

---

## PHASE 6: Hardening & Packaging ⬜ POST-MVP

### Step 27: Full-Stack Security Audit
1. `CORS_ALLOW_ALL_ORIGINS = True` → replace with explicit whitelist
2. Test 20+ prompt injection attacks against agent system prompt
3. Test 10+ command blacklist bypass attempts
4. Verify LAN-only enforcement for cross-device
5. Run `npm audit` + Python `safety check`
6. Verify JWT expiry, rotation, and revocation logic

### Step 28: Electron Desktop Packaging
1. `npm install electron electron-builder --save-dev`
2. `frontend/electron/main.js` — BrowserWindow (transparent, frameless, alwaysOnTop)
3. System tray: icon, "Open Setu", "Quit"
4. Global hotkey: `globalShortcut.register('Alt+Space', ...)`
5. `electron-builder` — Windows NSIS `.exe` target
6. Auto-start Daphne + Celery + Redis when Electron launches

---

## HOW TO RUN LOCALLY

See `ENVIRONMENT_SETUP.md` for complete setup instructions.

### Quick Start
```bash
# Terminal 1: Django ASGI Daphne Server
cd backend && venv\Scripts\activate.ps1
python -m daphne -b 0.0.0.0 -p 8000 setu.asgi:application

# Terminal 2: Frontend Dev Server
cd frontend && npm run dev
# Open: http://localhost:5173

# Terminal 3 (optional): Local Voice Loop
cd backend && venv\Scripts\activate.ps1
python listener.py
```
