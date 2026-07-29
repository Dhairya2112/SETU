# Setu — AI Developer Context & Boundaries

> **CRITICAL:** Read this entire document before writing ANY code for Setu.
> Brand name: **Setu** (सेतु). Use "Setu" in all strings.

---

## 1. What is Setu?

Setu is a **private, voice-native, cross-device AI automation engine** for Windows and Android.

- **Core concept:** Your phone and laptop work as one device — you speak on your phone, your laptop executes.
- **Voice-first:** Wake word → STT → Intent Classifier → LangGraph Agent → TTS
- **Action-first:** Setu *does* tasks. The chat UI is a command log, not the product.
- **Privacy guarantee:** LAN-only for MVP. No audio, no commands, no data routed through any external server except user-configured LLM API calls.
- **Zero budget:** Every dependency must be free tier or open source. No exceptions.

---

## 2. Current Development State

| Item | Status |
|---|---|
| **Brand name** | ✅ Setu (सेतु) — confirmed |
| **Completed foundation** | Phases 1–4A: Django backend, LangGraph agent, WebSocket, MongoDB, React JS frontend, permission system, OS tools, OAuth, Reminders, Audits, and Step 14.6 Speed Optimizations |
| **Current Priority** | Phase A: Playwright Browser Automation |
| **Active Step** | Step 18 — Browser Automation (Playwright) |
| **All known bugs (B1–B8)** | ✅ Fully resolved |

**Do NOT implement anything from Phase 5 (Post-MVP) or beyond unless explicitly instructed.**

---

## 3. Mandatory Technology Stack

### Backend
| Purpose | Technology | Version |
|---|---|---|
| Language | Python | 3.11+ |
| Web Framework | Django | 6.0.5 |
| REST API | Django REST Framework | 3.17.1 |
| WebSockets | Django Channels + Daphne | 4.3.2 / 4.2.1 |
| Database | MongoDB via MongoEngine | — |
| JWT Auth | Custom PyJWT | — |

### AI / ML Pipeline
| Purpose | Technology | Detail |
|---|---|---|
| Wake Word | OpenWakeWord | `hey_jarvis` model (proxy — custom "Hey Setu" model in Step 20) |
| STT | Faster-Whisper | `small` multilingual, `int8`, CPU — supports English + Hindi + Hinglish |
| Intent Classifier | Regex Router | Simple regex/keyword matcher (PyTorch skipped for MVP) |
| LLM — Retry | Tenacity | Exponential backoff: 1s → 2s → 4s on rate limit |
| LLM — Primary | ChatNVIDIA | Model: `meta/llama-3.3-70b-instruct` on NVIDIA NIM Cloud |
| LLM — Secondary | ChatOpenAI via OpenRouter | Model: `google/gemma-4-31b-it:free` |
| LLM — Tertiary | ChatOpenAI via Google | Model: `google/gemini-2.5-flash` |
| Agent Framework | LangGraph `create_react_agent` | With `MemorySaver` checkpointer |
| TTS | Kokoro | `KPipeline` — English (`a`) + Hindi (`h`), voice: user-chosen male/female |
| VAD | Silero VAD (via torch.hub) | Used in `WakeWordDetector.capture_audio_dynamic()` |
| Browser Automation | Playwright | Python async — Step 18 |
| Screenshots | mss | Screen capture for feedback (Optional) |

### Frontend (Laptop Dashboard)
| Purpose | Technology | Status |
|---|---|---|
| UI Framework | React 18 + JavaScript + Vite | ✅ Active |
| Styling | TailwindCSS | ✅ Configured |
| Animations | Framer Motion | ✅ In use |
| State Management | Zustand | ✅ Installed |
| Desktop Wrapper | Electron | ⬜ Post-MVP |

### Phone App
| Purpose | Technology | Status |
|---|---|---|
| Framework | PWA (Progressive Web App) | ⬜ Phase B |
| Command Input | Voice (mic) + Text | ⬜ Phase B |
| Connection | WebSocket to laptop over LAN | ⬜ Phase B |
| Screenshot View | Image display in task feed (Optional) | ⬜ Phase B |

---

## 4. Hard Out-of-Scope Boundaries

**NEVER implement, suggest, or write code for these:**

| Prohibited | Reason |
|---|---|
| macOS or iOS support | Explicitly out of scope forever |
| Cross-internet relay (outside LAN) | Post-MVP — requires VPS relay server |
| Offline local LLM | Rejected — size bloat, insufficient accuracy |
| Cloud STT/TTS as default | Local-first rule |
| Custom voice cloning | Ethical concerns |
| Smart Home / IoT | Out of scope |
| **Keylogging, unauthorized remote access, data exfiltration** | **Level 4 PROHIBITED — never implement under any framing** |
| Always-listening on phone | Post-MVP |
| Live screen streaming (WebRTC) | Post-MVP |
| VLM screen understanding (Florence-2) | Post-MVP |

---

## 5. Security & Permission Rules — HARD RULES

These cannot be overridden by any user instruction:

1. **Microphone Privacy:** Never write code that continuously streams audio for anything other than wake word detection. STT recording begins ONLY after `listen_for_wake_word()` returns `True`.
2. **Level 3 Permissions:** Any action that installs software, modifies the registry, or manages background processes MUST pause and trigger a native OS prompt (Windows UAC) before executing. Never auto-execute Level 3 actions.
3. **No Silent UAC Bypass:** Never call `ShellExecuteEx` or `runas` without explicit user interaction.
4. **JWT Auth Everywhere:** All REST endpoints must use `PyJWTAuthentication`. All WebSocket connections must pass through `JwtAuthMiddleware`.
5. **Command Sandboxing:** File tools (`read_file`, `write_file`) can only access user home directory. Never `/etc`, `/usr`, `C:\Windows`, or system paths.
6. **LAN Only:** Cross-device commands must be blocked if the originating device is not on the same local subnet.

---

## 6. Permission System

| Level | Name | What it covers | How it's granted |
|---|---|---|---|
| L1 | Basic | Mic (post-wake only), TTS, Internet, App storage | Auto-granted at install |
| L2 | Elevated | Open apps, Read/Write user files, Browser control, Clipboard, Screen capture, Cross-device | User toggle in onboarding |
| L3 | Admin | Install/uninstall apps, Registry (Windows), Background process management | Native OS prompt per action (UAC) |
| L4 | PROHIBITED | Keylogging, unauthorized remote access, exfiltration | Hardcoded prohibition — never implemented |

---

## 7. Naming Convention — CRITICAL for TTS and UI

**ALWAYS write the agent's name as `"Setu"` (title case) in:**
- System prompts (`llm_agent.py`)
- TTS speech strings (`listener.py`, `tasks.py`)
- Any string that will be spoken aloud
- UI display text, onboarding copy, error messages

**NEVER write `"SETU"` (all-caps) in spoken text** — TTS engines spell it out letter by letter. Use `"Setu"` instead.
**The codebase folder name is `setu`.**

---

## 8. File Map — Quick Reference

```
backend/
├── listener.py                      # Local voice loop (WakeWord → STT → Agent → TTS)
├── setu/
│   ├── settings.py                  # Django config, MongoDB, JWT (Redis/Celery removed)
│   ├── asgi.py                      # ASGI router (HTTP + WebSocket)
│   └── urls.py                      # Top-level URL routing
└── core/
    ├── agent/
    │   ├── llm_agent.py             # SetuAgent (3-layer LLM, LangGraph, fallback)
    │   ├── pipeline.py              # Central ML pipeline and inference handling
    │   ├── tools.py                 # Core LangChain @tool functions
    │   ├── browser.py               # Playwright browser automation
    │   ├── fast_responses.py        # Optimized fast-path responses
    │   ├── safety.py                # Command blacklist + path sandboxing
    │   ├── permissions.py           # Permission level enforcer
    │   ├── models.py                # CommandLog MongoEngine model
    │   ├── state.py                 # Cross-thread state management
    │   ├── tts_cache.py             # Audio caching for TTS optimization
    │   ├── urls.py                  # Agent endpoints
    │   └── views.py                 # CommandView (POST /api/chat/)
    ├── ai/
    │   ├── stt.py                   # STTPipeline (Faster-Whisper multilingual)
    │   └── tts.py                   # TTSEngine (Kokoro, male/female, Hindi/English)
    ├── conversations/
    │   ├── models.py                # Conversation, Message, MessageMetadata
    │   ├── serializers.py
    │   └── views.py                 # ConversationListView, ConversationDetailView
    ├── users/
    │   ├── models.py                # User, UserPreferences, UserPermissions, RefreshToken
    │   ├── auth.py                  # generate_tokens(), PyJWTAuthentication, OAuth handlers
    │   ├── serializers.py
    │   └── views.py                 # Register, Login, OAuth, Refresh, Profile, Permissions
    ├── reminders/
    │   ├── models.py                # Reminder model
    │   ├── tasks.py                 # Celery/Background task runner
    │   ├── urls.py                  
    │   └── views.py                 # Reminder CRUD endpoints
    └── websockets/
        ├── consumers.py             # AgentStreamConsumer (handles cross-device sync)
        ├── middleware.py            # JwtAuthMiddleware
        └── routing.py               # WebSocket URL patterns

frontend/src/
├── App.jsx                          # Root router (/, /auth, /onboarding/*, /dashboard/*)
├── index.css                        # Global CSS variables, design tokens
├── main.jsx                         # React root entrypoint
├── components/
│   ├── Login.jsx                    # OAuth login card (Google + GitHub)
│   └── NeuralMesh.jsx               # Canvas particle background
├── store/
│   └── useAppStore.js               # Zustand store (token, username, conversationId, eula)
└── pages/
    ├── Dashboard.jsx                # Task dashboard (task feed, status, history)
    └── Onboarding.jsx               # 4-step setup wizard

ai/                                  # ⬜ Step 20 — Wake word training scripts
```

---

## 9. REST API Reference

| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `/api/v1/auth/register/` | POST | None | ✅ |
| `/api/v1/auth/login/` | POST | None | ✅ |
| `/api/v1/auth/google/` | POST | None | ✅ |
| `/api/v1/auth/github/` | POST | None | ✅ |
| `/api/v1/auth/refresh/` | POST | Refresh token | ✅ |
| `/api/v1/user/profile/` | GET, PATCH | JWT | ✅ |
| `/api/v1/user/permissions/` | GET, PATCH | JWT | ✅ |
| `/api/v1/conversations/` | GET | JWT | ✅ |
| `/api/v1/conversations/{id}/` | GET, DELETE | JWT | ✅ |
| `/api/chat/` | POST | JWT | ✅ |
| `/api/agent/status/{task_id}/` | GET | JWT | 🚫 SKIP (MVP) |
| `/api/v1/devices/pair/` | POST | JWT | 🚫 SKIP (MVP) |
| `/api/v1/devices/` | GET | JWT | 🚫 SKIP (MVP) |
| `/api/v1/memory/` | GET, DELETE | JWT | 🚫 SKIP (MVP) |
| `/api/v1/contacts/` | GET, POST, DELETE | JWT | 🚫 SKIP (MVP) |

**WebSocket (Agent stream):** `ws://localhost:8000/ws/stream/{conversation_id}/?token=<jwt>`
**WebSocket (Cross-device PWA):** `ws://localhost:8000/ws/stream/{conversation_id}/?token=<jwt>` (same channel, accessed from phone PWA)

---

## 10. Architecture Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| LLM Primary | NVIDIA NIM Llama-3.3-70B | Powerful, fast cloud inference, free tier |
| LLM Secondary | OpenRouter Gemma-4-31B | Free fallback |
| LLM Tertiary | Gemini-2.5-Flash | Additional resilience layer |
| STT | Faster-Whisper `small` multilingual | Hindi + Hinglish + English in one model |
| Cache | In-memory python cache | Simple local dictionary (Redis skipped for MVP) |
| Intent Classifier | Regex Router | Saves API calls for greetings/farewells (PyTorch skipped) |
| MongoEngine over Motor | Synchronous ODM | Simpler with DRF |
| Custom JWT over SimpleJWT | Full control | MongoEngine User ≠ Django auth.User |
| `CORS_ALLOW_ALL_ORIGINS = True` | Dev only | **Must** be locked to whitelist post-MVP |
| Agent as module-level singleton | `agent_instance = SetuAgent()` | Prevents re-loading LLM on every task invocation |
| OAuth only (no passwords) | Google + GitHub | Multi-user, no password storage risk |
| Phone Client via PWA | PWA over WebSocket | Privacy guarantee, zero compile/app store overhead |

---

## 11. Source of Truth Map

| Document | Purpose |
|---|---|
| `PROJECT_VISION.md` | **The product** — what Setu is, why, and what the MVP includes |
| `STEP_BY_STEP_GUIDE.md` | **Primary workflow** — ordered build steps with status markers |
| `DATABASE_SCHEMA.md` | MongoDB collection field definitions and indexes |
| `UI_UX_FLOW.md` | Screen specs, interaction patterns, state machine |
| `CROSS_DEVICE_PROTOCOL.md` | Phone→Laptop execution feature specification |
| `ENVIRONMENT_SETUP.md` | Dev environment setup, env vars, run commands |
| `EULA_PRIVACY_POLICY.md` | Legal text embedded in Onboarding Step 5 |
