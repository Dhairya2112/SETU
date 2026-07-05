# Setu — Project Vision & MVP Brief

> **Team document — single source of truth for what we're building and why.**
> **MVP Deadline: July 20, 2026 | Team size: 3 | Budget: ₹0 — everything must be free**

---

## 1. One-Line Vision

> **"A private, voice-native AI that makes your phone and laptop work as one device — you speak, it acts."**

Setu (सेतु) — Sanskrit for *bridge*. The name IS the product: Setu bridges your devices, your languages, your distance from your laptop.

---

## 2. What Setu IS and IS NOT

| Setu IS | Setu IS NOT |
|---|---|
| A cross-device automation engine | A chatbot |
| Voice + text command interface | A conversational AI |
| An AI that **does** tasks | An AI that **talks about** tasks |
| Private — LAN only, no cloud relay | A cloud service |
| Multi-language (English + Hindi + Hinglish) | English-only |

The chat UI is a **command log and fallback input** — not the product. Think terminal, not ChatGPT.

---

## 3. The Experience

```
User (on phone): "Hey Setu, open Chrome and go to YouTube"
→ Laptop executes via Playwright → Phone receives confirmation

User (on phone): "Setu, Instagram khol"
→ Instagram launches on the phone (Hindi understood)

User (on phone): "Hey Setu, join my Google Meet"
→ Laptop opens browser → Goes to Calendar → Finds 3pm meeting → Clicks Join
```

---

## 4. Why This Is Worth Building

| Existing Tools | Their Gap |
|---|---|
| Siri, Bixby, Google Assistant | Voice-native but cloud-only, single device, data is logged |
| OpenAI Operator, Anthropic Computer Use | Does real tasks but cloud-only, API-based, no voice, paid |
| AirDroid, TeamViewer | Remote control but no AI, no voice, no automation |

**Setu's combination does not exist:**
Voice-native ✅ Cross-device ✅ Actually executes tasks ✅ Private (LAN-only) ✅ Free ✅ Hindi support ✅

---

## 5. Core Principles

Every feature must pass these four filters:

1. **Action over conversation.** If a feature only produces words and no action, it is low priority.
2. **Privacy by design.** Data never routes through an external server. LAN-only for MVP.
3. **Devices unified.** Phone and laptop are one system the user commands from anywhere in their home.
4. **Feels like yours.** Custom wake word, custom voice, custom language. Not a generic assistant.

---

## 6. Zero-Budget Constraint — HARD RULE

**This project costs ₹0 to build and run.** No paid APIs, no paid hosting, no paid tools. Every technology choice must be free tier or open source. This is non-negotiable.

| Component | Free Solution | Notes |
|---|---|---|
| **LLM (Primary)** | NVIDIA NIM free tier | Rate-limited but free |
| **LLM (Fallback 1)** | OpenRouter — Gemma-4-31B `:free` | Explicitly free model |
| **LLM (Fallback 2)** | Gemini 2.5 Flash (Google free tier) | Free with limits |
| **STT** | Faster-Whisper (local, open source) | Runs on your CPU, no API cost |
| **TTS** | Kokoro (local, open source) | Runs on your CPU, no API cost |
| **Wake Word** | OpenWakeWord (open source) | Custom model trained locally |
| **Database** | MongoDB Community (local) | Free, runs on laptop |
| **Browser Automation** | Playwright (open source) | Free |
| **Frontend & Phone Client** | React + Vite + PWA (open source) | Free, JavaScript only |
| **OAuth** | Google Cloud + GitHub (free tier) | OAuth is free for authentication |
| **Hosting** | None — runs on user's own laptop | LAN-only, no server needed |

**If any dependency requires payment, it must be replaced with a free alternative. No exceptions.**

---

## 7. Users & Auth

- **Users:** Personal use — yourself, friends, family, classmates.
- **Model:** Multi-user — each person has their own account, paired devices, and isolated data.
- **Auth:** OAuth only (Google + GitHub). No local username/password. No passwords stored.

---

## 8. MVP Scope — July 20, 2026

### In Scope

| Feature | Detail |
|---|---|
| **OAuth login** | Google + GitHub sign-in only |
| **LAN cross-device** | Phone accesses laptop server directly over LAN WebSockets using PWA |
| **Voice + text command from phone** | Speak or type → PWA sends to laptop over LAN WebSocket |
| **Launch any app on laptop** | `open_application` tool — "Open Chrome", "Open VS Code" |
| **Browser automation (laptop)** | Playwright — navigate, click, type, submit forms |
| **Task history** | Every command + result stored per user. Viewable on phone and laptop. |
| **Multi-user** | Each user has own account, own paired devices, own isolated data |
| **Language support** | English, Hindi, Hinglish. Auto-detect or user-selected in settings. |
| **Voice gender choice** | Male or Female voice. User picks in settings. Kokoro-powered. |
| **Reminders & Tasks** | Speak/type to schedule alarms/reminders. Executed by background daemon thread. |

### Out of Scope / futuristic scope for MVP

| Feature | When |
|---|---|
| Intent Pre-Classifier (PyTorch model) | Skipped for MVP (using Regex Router fast-path) |
| Redis Semantic Cache | Skipped for MVP (using memory python dictionary) |
| Native Desktop Automation (pywinauto) | Skipped for MVP (rely on python webbrowser/Playwright) |
| Cross-device ECDH / PIN discovery | Skipped for MVP (rely on standard JWT WebSocket auth) |
| Onboarding Upgrades (8 steps) | Skipped for MVP (rely on current 4-step wizard) |
| React Native Mobile Client | Skipped for MVP (rely on Responsive PWA) |
| Cross-internet (outside LAN) | Post-MVP — requires relay server |
| Controlling native phone app UI after launch | Post-MVP — Android Accessibility |
| Live screen streaming | Post-MVP — WebRTC |
| Advanced screen understanding (VLM) | Post-MVP — Florence-2 |
| macOS / iOS | Out of scope permanently |

---

## 9. Technical Architecture

### 9.1 Core Flow

```
Phone App (Browser PWA)
    │
    │  Voice/Text command (with JWT)
    ▼
LAN WebSocket (Daphne server)
    │
    ▼
Laptop Backend (Django Channels)
    │
    ├── Regex Router (Tier 0 — instant, free)
    │       │
    │       ├── GREETING / FAREWELL / THANKS
    │       │       → Direct pre-cached TTS response
    │       │
    │       └── COMPLEX (multi-step, ambiguous)
    │               → LangGraph Agent → LLM (3-layer fallback)
    │
    ├── Executing Playwright / OS Tools
    │
    └── Task result → MongoDB → shown in task history
```

### 9.2 Tech Stack

**Backend (Laptop)**

| Layer | Technology | Notes |
|---|---|---|
| Web Framework | Django 6 + DRF | Already built |
| Real-time | Django Channels + Daphne | Already built |
| Database | MongoDB (MongoEngine) | Already built |
| Auth | OAuth (Google + GitHub) via JWT | Already configured |
| AI Agent | LangGraph `create_react_agent` | Already built |
| Regex Router | Fast regex/keyword matcher | Already built |
| LLM Primary | NVIDIA NIM — Llama-3.3-70B | Already configured |
| LLM Fallback 1 | OpenRouter — Gemma-4-31B (free) | Already configured |
| LLM Fallback 2 | Gemini 2.5 Flash | Already configured |
| STT | Faster-Whisper `small` multilingual, int8 | Already configured |
| TTS | Kokoro — English (`a`) + Hindi (`h`), male/female | Already configured |
| Browser Automation | Playwright | **Active Step** |

**Phone & Laptop Frontend**

| Layer | Technology | Notes |
|---|---|---|
| Framework | React 18 + Vite | Already built (migrated from TS to JS) |
| Styling | TailwindCSS + Framer Motion | Already built |
| State | Zustand | Already built |
| PWA support | `manifest.json` + Service Worker | **To build** |

---

## 10. Speed Architecture — Keeping Setu Always Fast

No offline fallback. Instead, the architecture is designed so common interactions feel instant.

### 10.1 Tier 0 — Fast Response Router (Regex)

A lightweight regex/keyword matcher that intercepts trivial commands:

- GREETINGS, FAREWELLS, THANKS, CANCEL etc. match instantly.
- TTS audio is pre-generated at startup and cached in memory per voice.
- Responses feel sub-300ms.

---

## v1.0.0 Onboarding Setup Flow

Step 1: OAuth Sign-in (Google or GitHub)
Step 2: "What should I call you?" → name stored
Step 3: Test Microphone
Step 4: Permissions toggle + EULA acceptance → Dashboard

---

## 11. Security Model

| Layer | Rule |
|---|---|
| **Auth** | OAuth only (Google/GitHub). No local passwords. |
| **PWA connection** | standard WebSockets authenticated via JWT. |
| **Command sandboxing** | All commands pass through `safety.py` — blacklisted commands blocked. |
| **File access** | Agent restricted to user home directory. |
| **Network** | LAN-only for MVP. No data leaves the local network. |
| **Permissions** | L1 (auto) → L2 (user toggle) → L3 (OS prompt per action) → L4 (hardcoded off). |
| **Prohibited** | Keylogging, unauthorized remote access, data exfiltration — never implemented. |

---

## 12. Team Roles (To Be Confirmed)

| Role | Key Deliverables |
|---|---|
| **Backend / AI / Agent** | Playwright, WebSockets loop, daphne optimization, fallback routing |
| **Frontend & PWA** | Laptop Dashboard in JS, PWA settings, Service Worker, mobile layout, audio recorder |

---

## 13. The Name — ✅ Decided: Setu

**Setu** (सेतु) — Sanskrit for *bridge*.

- **Wake word:** "Hey Setu"
- **Voice:** Male or Female (user picks in Settings)
- **Language:** English, Hindi, or Auto-detect
