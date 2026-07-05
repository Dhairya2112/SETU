# Setu — Application Flow Document

This document defines the core user journeys, task execution loops, and state machines within the Setu AI automation system. Setu is a **cross-device automation engine** — the primary output is completed tasks, not conversational responses.

---

## 1. Core Philosophy

The chat UI is a **command log and fallback input** — not the product.

```
OLD (chatbot): User speaks → AI responds with words
NEW (Setu):    User speaks → AI executes → User sees completed work
```

---

## 2. Onboarding Flow (First Launch)

Setu uses a clean 4-step onboarding wizard to get the user set up quickly.

```mermaid
graph TD
    A[Launch App] --> B[Auth Screen — Google / GitHub OAuth]
    B -->|Success| C{First login?}
    B -->|Failure| B1[Error toast + retry]
    B1 --> B
    C -->|No| Z[Dashboard]
    C -->|Yes| D[Step 1: What should I call you?]
    D --> E[Step 2: Test Microphone]
    E --> F[Step 3: Permission Wizard + EULA]
    F --> G[Step 4: Done Screen]
    G --> Z
```

---

## 3. Core Voice Interaction Loop (Main Loop)

```mermaid
sequenceDiagram
    participant User
    participant PWA App
    participant Laptop Backend
    participant Regex Router
    participant LangGraph Agent

    Note over Laptop Backend: OpenWakeWord listening (IDLE)
    User->>Laptop Backend: "Hey Setu"
    Laptop Backend->>PWA App: WebSocket: state=LISTENING
    User->>Laptop Backend: Speaks command
    Laptop Backend->>Regex Router: Transcribed text (Faster-Whisper multilingual)
    Laptop Backend->>PWA App: WebSocket: state=THINKING

    alt Tier 0 Match (Greeting/Farewell/Thanks)
        Regex Router->>Laptop Backend: Return pre-cached response
    else Tier 2 Match (Complex Command)
        Regex Router->>LangGraph Agent: Route to LLM pipeline
        LangGraph Agent->>Laptop Backend: Execute Playwright / OS Tools
    end

    Laptop Backend->>PWA App: WebSocket: chunk_type=result
    Laptop Backend->>PWA App: WebSocket: state=IDLE
```

---

## 4. Cross-Device Execution Flow (Phone PWA → Laptop)

```mermaid
sequenceDiagram
    participant User
    participant Phone PWA (Browser)
    participant Laptop Backend
    participant Tool Executor

    User->>Phone PWA: Voice or text command
    Phone PWA->>Laptop Backend: WebSocket: ws://laptop_ip:8000/ws/stream/conv_id/?token=<jwt>
    Laptop Backend->>Laptop Backend: Verify JWT + subnet membership
    Laptop Backend->>Laptop Backend: safety.py blacklist check
    Laptop Backend->>Tool Executor: Execute Playwright/OS tools
    Tool Executor->>Laptop Backend: Result text + TTS audio stream
    Laptop Backend->>Phone PWA: Stream result + TTS audio
```

---

## 5. 2-Tier Response Architecture (Speed Optimization)

Every command passes through a 2-tier pipeline for optimal responsiveness.

```
User command (text from STT)
        │
        ▼
Tier 0: Fast Response Router (regex/keyword — instant, free)
        │
        ├── GREETING       → "Hey {name}! What can I do for you?"     → pre-cached TTS audio
        ├── FAREWELL        → "Goodbye {name}! I'll be here."          → pre-cached TTS audio
        ├── THANKS          → "You're welcome! Need anything else?"    → pre-cached TTS audio
        ├── HOW_ARE_YOU     → "I'm great! What can I help with?"      → pre-cached TTS audio
        ├── WHAT_ARE_YOU    → "I'm Setu, your AI assistant..."        → pre-cached TTS audio
        ├── CANCEL          → "Alright, cancelled!"                    → pre-cached TTS audio
        │
        └── No match? → Continue to Tier 2
                │
                ▼
Tier 2: LangGraph Agent → LLM pipeline (Primary Llama-3.3-70B → Secondary Gemma-4-31B → Tertiary Gemini-2.5-Flash)
```

| Tier | Latency | What It Handles | LLM Cost |
|---|---|---|---|
| **Tier 0** | < 0.3s | Greetings, farewells, thanks, small talk | Zero |
| **Tier 2** | 2–6s | Playwright browser tasks, system commands, files | Full |

---

## 6. Tool & Permission Execution Flow

```mermaid
flowchart TD
    A[Agent selects tool] --> B{Permission level?}
    B -->|L1 — Basic| C[Execute immediately]
    B -->|L2 — Elevated| D{User granted L2?}
    D -->|Yes| C
    D -->|No| E[Respond: I need permission. Enable in Settings.]
    B -->|L3 — Admin| F[Pause execution → trigger Windows UAC prompt]
    F -->|User accepts UAC| C
    F -->|User rejects UAC| G[Abort + notify user]
    C --> H[Return result to agent context]
    H --> I[Agent generates response text]
    I --> J[TTS → spoken + streamed to UI / phone]
```

---

## 7. Frontend UI State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Listening : Wake word / mic click / Alt+Space
    Listening --> Thinking : VAD silence (end of speech)
    Listening --> Idle : Cancel (Esc / tap away)
    Thinking --> Executing : Execute tool
    Executing --> Speaking : TTS stream begins
    Executing --> Error : Tool failure / timeout
    Speaking --> Listening : Barge-in detected
    Speaking --> Idle : Response complete + 3s wait
    Error --> Idle : Auto-dismiss / retry
```

**State descriptions:**

| State | UI Behaviour |
|---|---|
| **IDLE** | Command log visible. "Ready" indicator. Alt+Space activates. |
| **LISTENING** | Mic active. Input bar glows mint green. Audio waveform reacts. |
| **THINKING** | Pulsing "Synthesizing…" indicator. |
| **EXECUTING** | Step-by-step progress in task card. |
| **SPEAKING** | TTS audio plays. Text streams into task card. Barge-in enabled. |
| **ERROR** | Inline error in task card. Auto-dismisses. Retry available. |

---

## 8. Reminders & Scheduled Tasks Flow

```mermaid
sequenceDiagram
    participant User
    participant Agent
    participant DB as MongoDB
    participant Scheduler as Daemon Thread Scheduler (30s)
    participant Consumer as WebSocket Consumer
    participant Frontend as Frontend / Phone PWA

    User->>Agent: "Remind me to call Mom at 5 PM"
    Agent->>Agent: Parse time via dateparser
    Agent->>DB: Save Reminder (title="Call Mom", trigger_at=5:00 PM, is_completed=false)
    Agent->>User: Spoken/Text confirmation

    Note over Scheduler: Periodic check loop
    Scheduler->>DB: Query trigger_at <= now AND is_completed == false
    DB->>Scheduler: Returns "Call Mom" reminder
    Scheduler->>Consumer: Send reminder message via Channel Layer
    Consumer->>Frontend: WebSocket: chunk_type="reminder"
    Note over Frontend: Show popup/banner & play sound
    Scheduler->>DB: Update is_completed = true
```
