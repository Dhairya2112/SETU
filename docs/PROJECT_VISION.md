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
→ Setu shows plan: "1. Open Chrome  2. Navigate to YouTube — Proceed?"
→ User confirms → Laptop executes → Phone receives screenshot

User (on phone): "Setu, Instagram khol"
→ Instagram launches on the phone (Hindi understood)

User (on phone): "Hey Setu, join my Google Meet"
→ Setu: "1. Open browser  2. Go to Calendar  3. Find 3pm meeting  4. Click Join — Proceed?"
→ Laptop executes → Phone shows screenshot confirmation

User (on phone): "Do that again"
→ Setu reruns the last command

User (on phone): "Message Rahul that I'll be late"
→ Setu looks up Rahul in contacts → opens WhatsApp Web → sends message
```

---

## 4. Why This Is Worth Building

| Existing Tools | Their Gap |
|---|---|
| Siri, Bixby, Google Assistant | Voice-native but cloud-only, single device, data is logged |
| OpenAI Operator, Anthropic Computer Use | Does real tasks but cloud-only, API-based, no voice, paid |
| AirDroid, TeamViewer | Remote control but no AI, no voice, no automation |
| Tasker | Android-only, no AI, complex setup |

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
| **Cache/Broker** | Redis (local) | Free, runs on laptop |
| **Browser Automation** | Playwright (open source) | Free |
| **Desktop Automation** | pywinauto (open source) | Free |
| **Frontend** | React + Vite (open source) | Free |
| **Phone App** | React Native (open source) | Free |
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

### ✅ In Scope

| Feature | Detail |
|---|---|
| **OAuth login** | Google + GitHub sign-in only |
| **LAN cross-device** | Same WiFi or phone hotspot. mDNS discovery. PIN-based pairing. |
| **Voice + text command from phone** | Speak or type → phone sends to laptop over LAN WebSocket |
| **Launch any app on laptop** | `open_application` tool — "Open Chrome", "Open VS Code" |
| **Launch any app on phone** | Deep links — "Open Instagram", "Open YouTube" |
| **Browser automation (laptop)** | Playwright — navigate, click, type, submit forms |
| **Desktop automation (laptop)** | pywinauto — interact with native Windows app UIs |
| **Task plan confirmation** | For multi-step tasks, Setu shows the plan and asks before executing |
| **Screenshot feedback** | Opt-in per user. After each step, screenshot sent to phone via WebSocket. |
| **Task history** | Every command + result stored per user. Viewable on phone and laptop. |
| **Multi-user** | Each user has own account, own paired devices, own isolated data |
| **Custom wake word** | "Hey Setu" — PyTorch trained, ONNX exported |
| **Language support** | English, Hindi, Hinglish. Auto-detect or user-selected in onboarding. |
| **Voice gender choice** | Male or Female voice. User picks in onboarding. Kokoro-powered. |
| **Persistent memory** | MongoDB-backed. Setu remembers preferences, names, and past context across restarts. |
| **Contacts store** | User's contacts (name → WhatsApp/email). Enables "message Rahul" commands. |
| **Natural references** | "Do that again", "What did you just do?", "Actually open VS Code instead" |
| **Reliability architecture** | Intent classifier, semantic cache, context compression, proactive routing (see §9) |
| **Reminders & Tasks** | Speak/type to schedule alarms/reminders. Executed by Celery Beat and pushed via WS. |


### ❌ Out of Scope for MVP

| Feature | When |
|---|---|
| Cross-internet (outside LAN) | Post-MVP — requires relay server |
| Controlling native phone app UI after launch | Post-MVP — requires Android Accessibility Service |
| Live screen streaming | Post-MVP — WebRTC |
| Advanced screen understanding (VLM) | Post-MVP — Florence-2 |
| Always-listening on phone | Post-MVP — after wake word model is stable |
| macOS / iOS | Out of scope permanently |
| Offline local LLM fallback | Rejected — size bloat, accuracy insufficient |

---

## 9. Technical Architecture

### 9.1 Core Flow

```
Phone App (React Native)
    │
    │  Voice/Text command
    ▼
LAN WebSocket (mDNS discovery, PIN-paired)
    │
    ▼
Laptop Backend (Django + Celery)
    │
    ├── Intent Pre-Classifier (PyTorch — local, instant, free)
    │       │
    │       ├── SIMPLE (open app, system info, repeat)
    │       │       → Direct tool call, no LLM needed
    │       │
    │       └── COMPLEX (multi-step, ambiguous)
    │               → LangGraph Agent → LLM (3-layer fallback)
    │
    ├── Task Plan → shown to user → confirmed → executed
    │       │
    │       ├── Playwright (browser tasks)
    │       ├── pywinauto (desktop tasks)
    │       ├── App launcher (laptop apps)
    │       └── Deep link sender (phone apps)
    │
    ├── Screenshot capture (opt-in) → WebSocket → Phone
    └── Task result → MongoDB → shown in task history
```

### 9.2 Tech Stack

**Backend (Laptop)**

| Layer | Technology | Notes |
|---|---|---|
| Web Framework | Django 6 + DRF | Already built |
| Real-time | Django Channels + Daphne | Already built |
| Task Queue | Celery + Redis | Already built |
| Database | MongoDB (MongoEngine) | Already built |
| Auth | OAuth (Google + GitHub) via JWT | Needs upgrade from local login |
| AI Agent | LangGraph `create_react_agent` | Already built |
| Intent Classifier | PyTorch (DistilBERT or LSTM) | **To build** |
| LLM Primary | NVIDIA NIM — Llama-3.3-70B | Already configured |
| LLM Fallback 1 | OpenRouter — Gemma-4-31B (free) | Already configured |
| LLM Fallback 2 | Gemini 2.5 Flash | Already configured |
| Cache | Redis semantic cache | **To build** (replaces InMemoryCache) |
| STT | Faster-Whisper `small` multilingual, int8 | Needs model swap (`.en` → multilingual) |
| TTS | Kokoro — English (`a`) + Hindi (`h`), male/female | Needs voice selection logic |
| Browser Automation | Playwright | **To build** |
| Desktop Automation | pywinauto | **To build** |
| Wake Word | OpenWakeWord (custom PyTorch → ONNX) | **To build** — "Hey Setu" |
| Device Discovery | mDNS via zeroconf | **To build** |
| Screenshots | `mss` library | **To build** |

**Phone App (React Native)**

| Layer | Technology |
|---|---|
| Framework | React Native |
| Command Input | Voice (mic) + Text |
| Connection | WebSocket to laptop over LAN |
| Screenshot View | Image display in task feed |
| App Launching | Deep links (`instagram://`, `youtube://`, etc.) |

**Laptop Dashboard (React)**

| Layer | Technology | Notes |
|---|---|---|
| Framework | React 18 + Vite + TypeScript | Already built |
| Styling | TailwindCSS + Framer Motion | Already built |
| State | Zustand + TanStack React Query | Already built |

### 9.3 What's Already Built ✅

- Wake word detection (OpenWakeWord + Silero VAD)
- STT pipeline (Faster-Whisper — needs model swap for Hindi)
- TTS engine (Kokoro — needs voice selection)
- LangGraph agent with 3-layer LLM fallback + InMemoryCache
- WebSocket streaming (Django Channels + Daphne)
- JWT auth system (needs OAuth upgrade)
- MongoDB models (users, conversations, command logs, reminders)
- Onboarding flow (4-step wizard — needs language/voice step)
- Safety layer (command blacklist, path sandboxing, output truncation)
- Permission system (L1–L4)
- `open_application` tool (laptop app launching)
- System tools (`run_shell_command`, `get_system_info`, `get_current_time`, `web_search`, etc.)
- File tools (`read_file`, `write_file`, `search_files`, `list_directory`)
- React frontend (laptop dashboard)

### 9.4 Where PyTorch Is Used

PyTorch is used where it adds genuine functional value — not for show.

| Use Case | What It Does | MVP or Post? |
|---|---|---|
| **Custom wake word** | Train "Hey Setu" → ONNX → runs on device | ✅ MVP |
| **Intent pre-classifier** | Categorise command locally before LLM. Saves 60–70% of API calls. | ✅ MVP |
| **Screen understanding (VLM)** | Florence-2 for laptop to understand what it sees on screen | Post-MVP |

---

## 10. Reliability & Speed Architecture — Keeping Setu Always Alive & Fast

No offline fallback. Instead, the architecture is designed so cloud LLM limits are nearly impossible to hit, and common interactions feel instant.

### 10.0 Tier 0 — Fast Response Router (Regex)

A lightweight regex/keyword matcher that intercepts trivial commands **before** any ML model runs:

```
Command → Regex match (instant, zero-cost)
    ├── GREETING       → "Hey {name}! What can I do for you?"
    ├── FAREWELL       → "Goodbye {name}! I'll be here."
    ├── THANKS         → "You're welcome! Need anything else?"
    ├── HOW_ARE_YOU    → "I'm great! What can I help with?"
    ├── WHAT_ARE_YOU   → "I'm Setu, your AI assistant..."
    ├── CANCEL         → "Alright, cancelled!"
    └── No match       → pass to Intent Classifier (10.1)
```

**Result:** Greetings/farewells respond in < 0.3s. No LLM, no classifier, no TTS generation (uses pre-cached audio).

### 10.0.1 Pre-cached TTS Audio Bank

Common Tier 0 responses have TTS audio pre-generated at startup and cached in memory:

- ~20–30 phrases × user's selected voice variant
- Lazily built per voice on first use (~2–3 MB per voice)
- Eliminates 1–2s of TTS generation for cached responses

### 10.1 Intent Pre-Classifier (PyTorch)

A small local model classifies commands **before** they reach the LLM:

```
Command → Classifier (local, instant, free)
    ├── OPEN_APP_LAPTOP   → direct tool call, no LLM
    ├── OPEN_APP_PHONE    → direct deep link, no LLM
    ├── SYSTEM_INFO       → direct tool call, no LLM
    ├── REPEAT_LAST       → rerun from history, no LLM
    ├── TIME_DATE         → direct tool call, no LLM
    └── COMPLEX_TASK      → send to LLM
```

**Result:** ~60–70% of commands never touch the LLM. API usage drops dramatically.

### 10.2 Redis Semantic Cache

Replaces `InMemoryCache`. Persists across restarts. Uses embeddings for similarity matching.

- "Open Chrome" / "Launch Chrome" / "Start Chrome" → all hit the same cache entry
- Saves ~20% additional API calls

### 10.3 Context Window Compression

Conversation history costs tokens on every LLM call. Compress it:

- Keep last 4–6 messages in full
- Older messages → single summary line stored in MongoDB
- Reduces token usage ~30% per call

### 10.4 Proactive Rate Limit Routing

Don't wait for failures — route around them:

- Track API call count per provider in Redis (rolling 60-second window)
- If primary provider hits 80% of limit → proactively route to next provider
- Zero failures, zero retries, zero wasted calls

### 10.5 Request Deduplication

- Hash each command (text + 10-second timestamp window)
- Store hash in Redis with 10-second TTL
- Duplicate requests return the in-progress result instead of creating a new LLM call

### 10.6 Backup API Keys

Multiple free API keys per provider (one per team member). Rotate on limit.

### 10.7 Graceful Degradation

If everything somehow fails, Setu does not go silent:

```
"I'm having a little trouble right now. Your command is queued — I'll retry in 30 seconds."
```

Command stays in Redis queue, auto-retries. User sees a spinner, not a dead screen.

### 10.8 Instant Acknowledgment & Streaming TTS

- **Instant ack:** On receiving any command, immediately send an acknowledgment ("On it!") so the user knows Setu heard them — even before LLM starts processing.
- **Streaming TTS:** Instead of generating audio for the full response at once, split into sentences and stream audio sentence-by-sentence. User hears the first sentence ~0.3s after text is ready.

### Combined Impact

| Strategy | Calls Reduced | Speed Gain |
|---|---|---|
| Tier 0 fast router | ~10–15% (greetings/small talk) | **< 0.3s** for matched commands |
| Pre-cached TTS bank | — | **Eliminates 1–2s TTS** for common phrases |
| Instant acknowledgment | — | **Perceived < 0.2s** response time |
| Streaming TTS | — | **First word 0.3s** after text ready |
| Intent pre-classifier | ~60–70% | High |
| Semantic cache | ~20% | Medium |
| Context compression | ~30% fewer tokens/call | Medium |
| Proactive routing | — | Very High |
| Deduplication | ~10% | Medium |
| Backup keys | — | High |

**Net effect:** Setu uses ~30–40% of the API quota she would without these strategies. Free tier limits effectively become 2.5–3x larger. Common interactions feel instant.

---

## 11. Key Features — Detailed Specs

### 11.1 Persistent Memory

- **Storage:** MongoDB `user_memory` collection
- **What's remembered:** User preferences (browser, language), contact names, frequently used apps, past task patterns
- **How it works:** After each task, extract key facts → store as key-value pairs per user
- **LLM integration:** Relevant memories injected into system prompt before each call
- **Privacy:** Memory is per-user, never shared. User can view and delete memories.

### 11.2 Task Plan Confirmation

For any command that involves 2+ steps, Setu shows the plan before executing:

```
User: "Join my Google Meet"
Setu: "Here's my plan:
  1. Open Chrome
  2. Navigate to Google Calendar
  3. Find your 3pm meeting
  4. Click the Join button
  Proceed? [Yes] [No]"
```

- Single-step commands (e.g., "Open Chrome") execute immediately — no confirmation needed.
- User can disable confirmations in settings ("Trust mode").

### 11.3 Contacts Store

- **Storage:** MongoDB `contacts` collection, scoped per user
- **Fields:** `name`, `phone` (optional), `email` (optional), `whatsapp` (optional), `relationship` (friend/family/colleague)
- **How it's populated:** User adds manually via settings, or Setu asks "Who is Rahul?" on first mention and remembers
- **How it's used:** "Message Rahul" → lookup contact → find WhatsApp → open WhatsApp Web → send

### 11.4 Natural References

| User Says | Setu Does |
|---|---|
| "Do that again" | Reruns the last command from task history |
| "What did you just do?" | Reads back the last task result |
| "Actually, open VS Code instead" | Modifies the last intent (Chrome → VS Code) |
| "Cancel" / "Stop" | Aborts current task mid-execution |

Implementation: last command stored in Redis per user. Reference keywords detected by intent classifier.

### 11.5 Screenshot Feedback

- **Opt-in:** User selects preference in onboarding: `[Always] [Ask each time] [Never]`
- **Capture:** `mss` library on laptop after each significant task step
- **Delivery:** Compressed, sent via WebSocket to phone
- **Storage:** Not stored permanently — shown in real-time task feed only. Reduces space usage.

---

## 12. Personalization — Onboarding

```
Step 1: OAuth Sign-in (Google or GitHub)
Step 2: "What should I call you?" → name stored
Step 3: Choose Setu's language:   [English]  [Hindi]  [Auto-detect]
Step 4: Choose Setu's voice:      [Female ♀]  [Male ♂]
Step 5: Permission toggles + EULA acceptance
Step 6: Pair your phone (show PIN on laptop → enter on phone)
Step 7: Screenshot preference:    [Always]  [Ask each time]  [Never]
Step 8: "Hey Setu, I'm ready" → animated confirmation → Dashboard
```

---

## 13. Security Model

| Layer | Rule |
|---|---|
| **Auth** | OAuth only (Google/GitHub). No local passwords. |
| **Device pairing** | PIN-based on LAN. Phone must be on same WiFi to pair. |
| **Command sandboxing** | All commands pass through `safety.py` — blacklisted commands blocked. |
| **File access** | Agent restricted to user home directory. System paths blocked. |
| **Network** | LAN-only for MVP. No data leaves the local network. |
| **Permissions** | L1 (auto) → L2 (user toggle) → L3 (OS prompt per action) → L4 (hardcoded off). |
| **Prohibited** | Keylogging, unauthorized remote access, data exfiltration — never implemented. |

---

## 14. Team Roles (To Be Confirmed)

| Role | Key Deliverables |
|---|---|
| **Backend / AI / Agent** | Playwright, pywinauto, cross-device protocol, intent classifier, reliability architecture, OAuth |
| **React Native (Phone)** | Command input UI, WebSocket to laptop, screenshot viewer, deep link launching, pairing flow |
| **Wake Word + Dashboard** | PyTorch wake word training, laptop UI, task dashboard, onboarding updates |

---

## 15. The Name — ✅ Decided: Setu

**Setu** (सेतु) — Sanskrit for *bridge*.

- **Wake word:** "Hey Setu"
- **Voice:** Male or Female (user picks in onboarding)
- **Language:** English, Hindi, or Auto-detect
- ⚠️ **Action required:** Record 50+ "Hey Setu" samples and 200+ negative samples immediately.

---

## 16. Post-MVP Roadmap (Startup Path)

| Phase | Feature |
|---|---|
| v2 | Cross-internet relay via VPS |
| v2 | Always-listening on phone (Android foreground service) |
| v3 | Native phone app control (Android Accessibility Service) |
| v3 | Live screen streaming (WebRTC) |
| v4 | Screen understanding VLM (Florence-2, local PyTorch) |
| v4 | Electron packaging + Docker + one-click install |
| v5 | Landing page + public launch |

---

*Created: June 17, 2026*
*Last updated: June 17, 2026 — Name confirmed, Hindi support, voice choice, reliability architecture, persistent memory, task plans, contacts, natural references*
*Next update: After team sync — assign roles, decide demo scenario, update STEP_BY_STEP_GUIDE.md*
