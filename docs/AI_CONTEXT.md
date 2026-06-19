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
| **Completed foundation** | Phases 1–3: Django backend, LangGraph agent, WebSocket, MongoDB, React frontend, permission system, OS tools |
| **Current Priority** | Phase 4: Setu MVP Sprint — July 20, 2026 deadline |
| **Active Step** | Step 13 — OAuth Integration (Google + GitHub) |
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
| Task Queue | Celery | 5.6.3 |
| Message Broker | Redis | 8.0.0 @ `127.0.0.1:6379` |
| Database | MongoDB via MongoEngine | — |
| JWT Auth | Custom PyJWT | — |

### AI / ML Pipeline
| Purpose | Technology | Detail |
|---|---|---|
| Wake Word | OpenWakeWord | `hey_jarvis` model (proxy — custom "Hey Setu" model in Step 20) |
| STT | Faster-Whisper | `small` multilingual, `int8`, CPU — supports English + Hindi + Hinglish |
| Intent Classifier | PyTorch (DistilBERT/LSTM) | Local, instant — classifies SIMPLE vs COMPLEX before LLM (Step 15) |
| LLM — Cache | Redis semantic cache | Embedding-based similarity, persists across restarts (Step 16) |
| LLM — Retry | Tenacity | Exponential backoff: 1s → 2s → 4s on rate limit |
| LLM — Primary | ChatNVIDIA | Model: `meta/llama-3.3-70b-instruct` on NVIDIA NIM Cloud |
| LLM — Secondary | ChatOpenAI via OpenRouter | Model: `google/gemma-4-31b-it:free` |
| LLM — Tertiary | ChatOpenAI via Google | Model: `google/gemini-2.5-flash` |
| Agent Framework | LangGraph `create_react_agent` | With `MemorySaver` checkpointer |
| TTS | Kokoro | `KPipeline` — English (`a`) + Hindi (`h`), voice: user-chosen male/female |
| VAD | Silero VAD (via torch.hub) | Used in `WakeWordDetector.capture_audio_dynamic()` |
| Browser Automation | Playwright | Python async — Step 18 |
| Desktop Automation | pywinauto | Windows native UI — Step 19 |
| Device Discovery | zeroconf (mDNS) | `_setu-sync._tcp.local.` — Step 17 |
| Screenshots | mss | Screen capture for feedback — Step 21 |

### Frontend (Laptop Dashboard)
| Purpose | Technology | Status |
|---|---|---|
| UI Framework | React 18 + TypeScript + Vite | ✅ Active |
| Styling | TailwindCSS | ✅ Configured |
| Animations | Framer Motion | ✅ In use |
| State Management | Zustand | ✅ Installed |
| Server State | TanStack React Query | ✅ Installed |
| Desktop Wrapper | Electron | ⬜ Post-MVP |

### Phone App
| Purpose | Technology | Status |
|---|---|---|
| Framework | React Native | ⬜ Step 24 |
| Command Input | Voice (mic) + Text | ⬜ Step 24 |
| Connection | WebSocket to laptop over LAN | ⬜ Step 17 |
| App Launching | Deep links (`instagram://`, etc.) | ⬜ Step 24 |
| Screenshot View | Image display in task feed | ⬜ Step 24 |

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
│   ├── settings.py                  # Django config, MongoDB, Redis, Celery, JWT
│   ├── asgi.py                      # ASGI router (HTTP + WebSocket)
│   ├── urls.py                      # Top-level URL routing
│   └── celery.py                    # Celery app initialization
└── core/
    ├── agent/
    │   ├── llm_agent.py             # SetuAgent (3-layer LLM, LangGraph, fallback)
    │   ├── tasks.py                 # Celery task: process_agent_command (singleton agent)
    │   ├── tools.py                 # All LangChain @tool functions ✅
    │   ├── safety.py                # Command blacklist + path sandboxing ✅
    │   ├── permissions.py           # Permission level enforcer ✅
    │   ├── models.py                # CommandLog MongoEngine model ✅
    │   └── views.py                 # CommandView (POST /api/chat/)
    ├── ai/
    │   ├── stt.py                   # STTPipeline (Faster-Whisper multilingual)
    │   ├── tts.py                   # TTSEngine (Kokoro, male/female, Hindi/English)
    │   └── classifier.py            # IntentClassifier (PyTorch) ⬜ Step 15
    ├── conversations/
    │   ├── models.py                # Conversation, Message, MessageMetadata
    │   ├── serializers.py
    │   └── views.py                 # ConversationListView, ConversationDetailView
    ├── cross_device/                # ⬜ Step 17 — new module
    │   ├── mdns.py                  # mDNS advertiser (zeroconf)
    │   ├── pairing.py               # ECDH + PIN pairing logic
    │   ├── consumers.py             # CrossDeviceConsumer (WebSocket)
    │   └── models.py                # DevicePairing MongoEngine model
    ├── memory/                      # ⬜ Step 22 — new module
    │   ├── models.py                # UserMemory, Contact MongoEngine models
    │   └── manager.py               # Memory injection, extraction logic
    ├── users/
    │   ├── models.py                # User, UserPreferences, UserPermissions, RefreshToken
    │   ├── auth.py                  # generate_tokens(), PyJWTAuthentication, OAuth handlers
    │   ├── serializers.py
    │   └── views.py                 # Register, Login, OAuth, Refresh, Profile, Permissions
    ├── wake_word/
    │   └── detector.py              # WakeWordDetector (OpenWakeWord + Silero VAD)
    └── websockets/
        ├── consumers.py             # AgentStreamConsumer
        ├── middleware.py            # JwtAuthMiddleware
        └── routing.py              # WebSocket URL patterns

frontend/src/
├── App.tsx                          # Root router (/, /auth, /onboarding/*, /dashboard/*)
├── index.css                        # Global CSS variables, design tokens
├── main.tsx                         # React root + QueryClientProvider
├── components/
│   ├── Login.tsx                    # OAuth login card (Google + GitHub)
│   └── NeuralMesh.tsx               # Canvas particle background
├── store/
│   └── useAppStore.ts               # Zustand store (token, username, conversationId, eula)
└── pages/
    ├── Dashboard.tsx                # Task dashboard (task feed, status, history)
    └── Onboarding.tsx               # 8-step setup wizard

mobile/                              # ⬜ Step 24 — React Native phone app
ai/                                  # ⬜ Step 20 — Wake word training scripts
```

---

## 9. REST API Reference

| Endpoint | Method | Auth | Status |
|---|---|---|---|
| `/api/v1/auth/register/` | POST | None | ✅ (local — to be replaced by OAuth) |
| `/api/v1/auth/login/` | POST | None | ✅ (local — to be replaced by OAuth) |
| `/api/v1/auth/google/` | POST | None | ⬜ Step 13 |
| `/api/v1/auth/github/` | POST | None | ⬜ Step 13 |
| `/api/v1/auth/refresh/` | POST | Refresh token | ✅ |
| `/api/v1/user/profile/` | GET, PATCH | JWT | ✅ |
| `/api/v1/user/permissions/` | GET, PATCH | JWT | ✅ |
| `/api/v1/conversations/` | GET | JWT | ✅ |
| `/api/v1/conversations/{id}/` | GET, DELETE | JWT | ✅ |
| `/api/chat/` | POST | JWT | ✅ |
| `/api/agent/status/{task_id}/` | GET | JWT | ⚠️ Mock only |
| `/api/v1/devices/pair/` | POST | JWT | ⬜ Step 17 |
| `/api/v1/devices/` | GET | JWT | ⬜ Step 17 |
| `/api/v1/memory/` | GET, DELETE | JWT | ⬜ Step 22 |
| `/api/v1/contacts/` | GET, POST, DELETE | JWT | ⬜ Step 22 |

**WebSocket (Agent stream):** `ws://localhost:8000/ws/stream/{conversation_id}/?token=<jwt>`
**WebSocket (Cross-device):** `ws://localhost:8000/ws/device/{device_id}/?token=<jwt>` ⬜ Step 17

---

## 10. Architecture Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| LLM Primary | NVIDIA NIM Llama-3.3-70B | Powerful, fast cloud inference, free tier |
| LLM Secondary | OpenRouter Gemma-4-31B | Free fallback |
| LLM Tertiary | Gemini-2.5-Flash | Additional resilience layer |
| STT | Faster-Whisper `small` multilingual | Hindi + Hinglish + English in one model |
| Cache | Redis semantic cache | Persists across restarts, similarity matching |
| Intent Classifier | Local PyTorch | Saves 60–70% API calls for simple commands |
| MongoEngine over Motor | Synchronous ODM | Simpler with DRF |
| Custom JWT over SimpleJWT | Full control | MongoEngine User ≠ Django auth.User |
| `CORS_ALLOW_ALL_ORIGINS = True` | Dev only | **Must** be locked to whitelist post-MVP |
| Agent as module-level singleton | `agent_instance = SetuAgent()` | Prevents re-loading LLM on every Celery task |
| OAuth only (no passwords) | Google + GitHub | Multi-user, no password storage risk |
| LAN-only cross-device | No cloud relay | Privacy guarantee, zero cost |

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
