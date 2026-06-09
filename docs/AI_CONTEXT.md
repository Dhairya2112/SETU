# AI Developer Context & Boundaries (POOKIE Project)

**CRITICAL: Read this entire document before writing ANY code for the POOKIE project.**

---

## 1. Project Overview

POOKIE is a cross-platform, **local-first** AI personal agent for Windows, Linux, and Android. It uses voice as the primary input (wake word → STT → LLM → TTS) and a React dashboard as the visual interface. The backend is Django + Celery + Django Channels. All AI inference runs locally or via the fastest available cloud API (never sent to third parties without consent).

---

## 2. Current Phase

**We are in Phase 3, Step 11** (Connect UI to Backend). Check `STEP_BY_STEP_GUIDE.md` for the exact sub-step currently being worked on. Do not implement anything from Phase 4 (Mobile) or Phase 5 (Polish) unless explicitly instructed.

---

## 3. Hard Out-of-Scope Boundaries

Do **NOT** implement, suggest, or write code for these — ever:

| Prohibited | Reason |
|---|---|
| macOS or iOS support | Explicitly out of scope |
| Third-party plugin marketplaces | Post-launch |
| Cloud STT/TTS as default | Local-first rule; cloud is only a fallback |
| Multi-user / team features | Personal agent only |
| Custom voice cloning | Ethical concerns |
| Smart Home / IoT (HomeAssistant, Alexa) | Out of scope |
| Keylogging, remote desktop, data exfiltration | Level 4 PROHIBITED — never implement |

---

## 4. Mandatory Technology Stack

When generating code, **only** use these technologies. Do not suggest alternatives unless the specified tech is proven broken.

### Backend
| Purpose | Technology | Version | Key File |
|---|---|---|---|
| Language | Python | 3.11+ | — |
| Web Framework | Django | 6.0.5 | `backend/pookie/settings.py` |
| REST API | Django REST Framework | 3.17.1 | `core/*/views.py` |
| WebSockets | Django Channels + Daphne | 4.3.2 / 4.2.1 | `core/websockets/consumers.py` |
| Task Queue | Celery | 5.6.3 | `core/agent/tasks.py` |
| Message Broker | Redis | 8.0.0 | `127.0.0.1:6379` |
| Database | MongoDB via MongoEngine | — | `core/*/models.py` |
| JWT Auth | Custom PyJWT | — | `core/users/auth.py` |

### AI / ML
| Purpose | Technology | Notes |
|---|---|---|
| Wake Word | OpenWakeWord (`openwakeword`) | Currently using `hey_jarvis` model; custom model in Phase 5 |
| STT | Faster-Whisper (`faster-whisper`) | `small.en`, `int8`, CPU |
| LLM Primary | ChatNVIDIA (`langchain-nvidia-ai-endpoints`) | Model: `deepseek-ai/deepseek-v4-flash` |
| LLM Fallback | ChatOpenAI via OpenRouter | Model: `google/gemma-4-31b-it:free` |
| Agent Framework | LangGraph `create_react_agent` | With `MemorySaver` checkpointer |
| TTS Primary | Kokoro (`kokoro`) | `KPipeline(lang_code='a')`, voice `af_heart` |
| VAD | Silero VAD (via torch.hub) | Used in `WakeWordDetector.capture_audio_dynamic()` |

### Frontend
| Purpose | Technology | Notes |
|---|---|---|
| UI Framework | React 18 + TypeScript + Vite | `frontend/` |
| Styling | TailwindCSS | Already configured |
| Animations | Framer Motion | Already in use |
| State Management | Zustand | **NOT YET INSTALLED** — install in Step 11.4 |
| Server State | TanStack React Query | **NOT YET INSTALLED** — install in Step 11.4 |
| Desktop Wrapper | Electron | **NOT YET CONFIGURED** — Step 13 |
| Mobile | React Native | **NOT YET STARTED** — Phase 4 |

---

## 5. Security & Permission Rules

These are HARD rules — never violate them regardless of what the user asks:

1. **Microphone Privacy:** Never write code that continuously streams audio to memory for anything other than wake word detection. STT recording begins ONLY after `listen_for_wake_word()` returns `True`.
2. **Level 3 Permissions:** Any action that installs software, modifies the registry, or manages background processes MUST pause and trigger a native OS prompt (Windows UAC / Linux polkit) before executing. Never auto-execute Level 3 actions.
3. **No Silent UAC Bypass:** Never write code that calls `ShellExecuteEx` or `runas` without explicit user interaction.
4. **JWT Auth:** All REST endpoints must use `PyJWTAuthentication`. All WebSocket connections must pass through `JwtAuthMiddleware`.

---

## 6. Naming Conventions (CRITICAL for TTS)

**ALWAYS write the agent's name as `"Pookie"` (title case) in:**
- System prompts (`llm_agent.py`)
- TTS speech strings (`listener.py`, `tasks.py`)
- Any string that will be spoken aloud

**NEVER write `"POOKIE"` (all-caps) in spoken text** — TTS engines will spell it out as individual letters: "P... O... O... K... I... E".

---

## 7. Architecture Decision Log

| Decision | Choice | Reason |
|---|---|---|
| LLM Primary | ChatNVIDIA DeepSeek | Free tier, strong reasoning, fast |
| LLM Fallback | OpenRouter Gemma 4 | Free, no cost fallback |
| No intent classifier yet | LLM handles routing | Fine-tuned DistilBERT model is Phase 5 work |
| MongoEngine over Motor | Synchronous ODM | Simpler for DRF; async Motor for future optimization |
| Custom JWT over SimpleJWT | Full control | MongoEngine User ≠ Django auth.User |
| `dj-rest-auth` installed but unused | Available for OAuth | OAuth not configured; local auth is primary for now |
| `CORS_ALLOW_ALL_ORIGINS = True` | Dev only | MUST be locked down to whitelist in Phase 5 |

---

## 8. Source of Truth Documents

| Document | Use For |
|---|---|
| `STEP_BY_STEP_GUIDE.md` | **Primary workflow** — what to build next, status tracking, bug list |
| `PRD.md` | Product goals, user personas, success metrics |
| `TRD.md` | Full API spec, component design, data schemas |
| `DATABASE_SCHEMA.md` | MongoDB collection field definitions |
| `APP_FLOW.md` | UI state machines, user journeys |
| `UI_UX_FLOW.md` | Detailed screen specs, interaction patterns |
| `EULA_PRIVACY_POLICY.md` | Legal text to embed in Onboarding Step 4 |
| `backend_learning_path.md` | End-to-end architecture explanation |

---

## 9. File Map (Quick Reference)

```
backend/
├── listener.py                    # Local voice loop (wake word → STT → agent → TTS)
├── pookie/
│   ├── settings.py                # Django config, MongoDB, Redis, Celery, JWT
│   ├── asgi.py                    # ASGI router (HTTP + WebSocket)
│   ├── urls.py                    # Top-level URL routing
│   └── celery.py                  # Celery app initialization
└── core/
    ├── agent/
    │   ├── llm_agent.py           # POOKIEAgent (ChatNVIDIA, LangGraph, fallback)
    │   ├── tasks.py               # Celery task: process_agent_command
    │   └── views.py               # CommandView (POST /api/chat/)
    ├── ai/
    │   ├── stt.py                 # STTPipeline (Faster-Whisper)
    │   └── tts.py                 # TTSEngine (Kokoro, generate_base64)
    ├── conversations/
    │   ├── models.py              # Conversation, Message, MessageMetadata
    │   ├── serializers.py         # ConversationSerializer
    │   └── views.py               # ConversationListView, ConversationDetailView
    ├── users/
    │   ├── models.py              # User, UserPreferences, UserPermissions, RefreshToken
    │   ├── auth.py                # generate_tokens(), PyJWTAuthentication
    │   ├── serializers.py         # UserSerializer, etc.
    │   └── views.py               # RegisterView, LoginView, RefreshView, ProfileView
    ├── wake_word/
    │   └── detector.py            # WakeWordDetector (OpenWakeWord + Silero VAD)
    └── websockets/
        ├── consumers.py           # AgentStreamConsumer
        ├── middleware.py          # JwtAuthMiddleware
        └── routing.py            # WebSocket URL patterns

frontend/src/
├── App.tsx                        # Root router (/, /auth, /onboarding/*, /dashboard/*)
├── index.css                      # Global CSS variables, custom scrollbar
├── main.tsx                       # React root mount
├── components/
│   ├── Login.tsx                  # OAuth/local login card
│   ├── NeuralMesh.tsx             # Canvas particle background
│   └── Orb.tsx                   # 3D animated AI orb (NOT YET INTEGRATED)
├── hooks/
│   ├── useAgentSocket.ts          # WebSocket hook (messages, isThinking, isSpeaking)
│   └── useAudioAnalyser.ts        # Web Audio API hook (mic input, energy level)
└── pages/
    ├── Dashboard.tsx              # Main workstation (Automation, Dashboard, Chats tabs)
    └── Onboarding.tsx             # 3-step setup wizard
```
