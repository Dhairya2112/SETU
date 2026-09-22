# SETU — Agentic AI Workstation

> **hybrid AI workstation co-pilot designed and built by Dhairya Dave.**  
> A desktop voice and text agent that lives on your hardware, automates OS workflows, and reasons via multi-layer cloud LLMs.

---

## 1. Overview & Architecture Reality

SETU is an agentic AI assistant built to run directly on your own computer. It listens for voice commands (or accepts typed input via a web dashboard), executes OS-level actions through an extensible tool registry, and speaks its response back via local neural TTS over WebSockets.

### The Truth About Privacy: A True Hybrid Architecture

There is a common misconception that SETU is a 100% offline, air-gapped system. **It is not.** SETU operates on a **Hybrid Architecture**:

```
+─────────────────────────────────────────────────────────────────────────────+
|                         ON-DEVICE (LOCAL WORKSTATION)                       |
|                                                                             |
|  ┌─────────────────────────┐                 ┌───────────────────────────┐  |
|  │   AUDIO & SPEECH CORE   │                 │      NATIVE OS TOOLS      │  |
|  │ Faster-Whisper (int8)   │                 │ Native WASAPI Volume      │  |
|  │ Silero VAD (0.35 gate)  │                 │ App & Process Management  │  |
|  │ Kokoro 0.7 Streaming TTS│                 │ Sandboxed File & Shell    │  |
|  └────────────┬────────────┘                 │ Playwright Browser Agent  │  |
|               │                              └─────────────┬─────────────┘  |
|               │ Local Transcription                        │ Local Action   |
|               ▼                                            ▼                |
|  ┌───────────────────────────────────────────────────────────────────────┐  |
|  │                 LOCAL ASGI DAEMON (Daphne / Channels)                 │  |
|  │ - Client Surfaces: React 19 Dashboard (:5173) & Mobile Remote (/mobile│  |
|  │ - Database: Local MongoDB (:27017) for history, profiles & reminders  │  |
|  │ - Tier 0 FastResponseRouter: Instant regex matching (< 300ms)         │  |
|  └───────────────────────────────────┬───────────────────────────────────┘  |
+──────────────────────────────────────┼──────────────────────────────────────+
                                       │ Encrypted TLS API Requests
                                       ▼
+─────────────────────────────────────────────────────────────────────────────+
|                     CLOUD COGNITIVE ENGINE (EXTERNAL APIS)                  |
|                                                                             |
|  ┌───────────────────────────────────────────────────────────────────────┐  |
|  │ 3-LAYER RESILIENCE LLM PIPELINE (LangGraph create_react_agent)        │  |
|  │                                                                       │  |
|  │ Layer 1 (Primary)   — Google Gemini API (gemini-3.1-flash-lite)       │  |
|  │ Layer 2 (Fallback)  — OpenRouter API    (google/gemma-2-27b-it:free)  │  |
|  │ Layer 3 (Tertiary)  — NVIDIA NIM API    (meta/llama-3.1-8b-instruct)  │  |
|  └───────────────────────────────────────────────────────────────────────┘  |
+─────────────────────────────────────────────────────────────────────────────+
```

### What Stays Local vs. What Goes to the Cloud

| Component | Execution Location | Privacy & Data Handling |
|---|---|---|
| **Microphone & Voice Input** | **100% Local (On-Device)** | Transcribed locally using `faster-whisper` (`large-v3-turbo`, int8 CPU). Raw microphone audio never leaves your machine. |
| **Voice Synthesis (TTS)** | **100% Local (On-Device)** | Generated locally using `Kokoro 0.7` neural TTS and streamed as base64 WAV chunks over localhost WebSockets. |
| **Operating System Actions** | **100% Local (On-Device)** | Native WASAPI volume control, process launch/kill, file read/write/search, and PowerShell execution happen strictly inside your machine's OS. |
| **Browser Automation** | **100% Local (On-Device)** | Playwright launches a local Chromium instance on your machine to automate web navigation and data extraction. |
| **Data Persistence** | **100% Local (On-Device)** | MongoDB Community Server stores conversation histories, user settings, refresh tokens, and reminders locally on `mongodb://localhost:27017/setu_db`. |
| **Cognitive Reasoning & Planning** | **Cloud APIs (External)** | Text prompts and tool descriptions are sent over encrypted TLS (HTTPS) to external LLM providers (**Google AI Studio**, **OpenRouter**, or **NVIDIA NIM**). |

---

## 2. Current Tech Stack

### Backend
| Component | Technology | Description |
|---|---|---|
| Web & ASGI Server | **Django 6 + Daphne** | High-performance asynchronous WebSocket & HTTP server |
| Real-time Transport | **Django Channels 4** | Bi-directional streaming over `/ws/stream/<conversation_id>/` |
| Agent Orchestration | **LangGraph + LangChain** | `create_react_agent` with thread-bounded checkpoint memory (`BoundedMemorySaver`) |
| Speech-to-Text (STT) | **faster-whisper (`large-v3-turbo`)** | Quantized int8 CPU transcription + Silero VAD (0.35 threshold) |
| Text-to-Speech (TTS) | **Kokoro 0.7** | Local multi-voice neural TTS (`af_heart`, `am_echo`, `hf_alpha`, `hm_omega`) |
| Databases | **MongoDB 7.x/8.x + SQLite** | MongoDB (MongoEngine) for conversations/reminders; SQLite for Django internal auth |
| Browser Sub-Agent | **Playwright Chromium** | Headless/headed autonomous web navigation and scraping |
| Fault Tolerance | **Tenacity** | Exponential back-off retry logic across LLM provider layers |

### Frontend
| Component | Technology | Description |
|---|---|---|
| Framework | **React 19 + Vite 8** | Modern reactive client architecture |
| State Management | **Zustand 5** | Persistent auth tokens, active settings, and onboarding state |
| Routing | **React Router v7** | Client routing (`/`, `/login`, `/dashboard`, `/mobile`, `/onboarding`) |
| 3D Visuals | **Three.js + React Three Fiber** | Interactive animated `NeuralMesh` background canvas |
| Styling | **Tailwind CSS v4** | Dark-mode design system with custom glassmorphism panels |
| Audio Visualizer | **Web Audio API** | Real-time microphone input visualizer hook (`useAudioAnalyser`) |
| Socket Lifecycle | **Custom Hook (`useAgentSocket`)**| WebSocket auth, text/voice streaming, and audio playback queue |

---

## 3. Core Features Currently Built & Working

### A. 3-Layer LLM Fallback Pipeline
To avoid downtime and API rate limits, SETU chains three distinct cloud providers into a unified LangGraph agent:
1. **Layer 1 (Primary):** **Google Gemini API** (`gemini-3.1-flash-lite`, 10s timeout) — fast, responsive primary brain.
2. **Layer 2 (Fallback):** **OpenRouter API** (`google/gemma-2-27b-it:free`, 6s timeout) — high-quality open-weights fallback.
3. **Layer 3 (Tertiary):** **NVIDIA NIM API** (`meta/llama-3.1-8b-instruct`, 5s timeout) — rapid final safety net.

* **Bounded Memory:** Checkpoint memory is bounded per thread (`BoundedMemorySaver` caps at 50 checkpoints) to eliminate long-term memory leaks.
* **Checkpoint Healing:** Automatically cleanses broken or dangling tool-call states before invoking a new conversational turn.

### B. Tier 0 Fast-Response Router (< 300ms)
Before hitting cloud LLMs, user input is evaluated by a pre-compiled regex router (`FastResponseRouter`). Queries like *"hello"*, *"who are you"*, *"what time is it"*, or *"how are you"* bypass the LLM entirely and return instant replies, with audio generated via Kokoro.

### C. Registered OS Agent Tools (14 Active Tools)

#### Level 1 Tools (Always Allowed)
* `get_current_time`: Returns current date, time, and day of the week.
* `get_system_info`: Inspects CPU load, RAM usage, disk partitions, battery level, and OS version.
* `check_os_permissions`: Validates desktop automation rights and active execution policies.
* `gather_information`: Internal reasoning and research fallback tool.
* `set_reminder`: Schedules persistent natural-language reminders stored in MongoDB.

#### Level 2 Tools (User Permission Gated)
* `open_application`: Launches desktop programs, executable paths, or default system URLs.
* `close_application`: Terminates running OS processes by name.
* `run_shell_command`: Executes PowerShell commands with path whitelisting and command blocklisting.
* `control_volume`: Adjusts system master volume percentage, mute, and unmute via native WASAPI.
* `read_file`: Reads contents from permitted filesystem paths.
* `write_file`: Safely creates or updates files with directory validation.
* `search_files`: Recursive glob and pattern search across directories.
* `list_directory`: Lists directory children with file sizes and directory metadata.
* `delegate_browser_task`: Hands control to a Playwright sub-agent to navigate web pages, click elements, fill forms, and extract content autonomously.

### D. Full-Featured Web Dashboard & Companion Surfaces
* **Web Dashboard (`/dashboard`):** Real-time conversational interface with hold-to-talk voice recording, live audio visualizer, text input, streaming markdown rendering, and animated 3D NeuralMesh.
* **Settings Panel:** Live runtime configuration of AI provider (Gemini / OpenRouter / NVIDIA), TTS voice gender, playback speed, language (English / Hindi), wake-word sensitivity, and permission tiers.
* **Mobile Chat (`/mobile`):** Mobile-optimized companion interface designed for LAN pairing over your local Wi-Fi network.
* **Standalone Voice Loop (`listener.py`):** Terminal-based script allowing hands-free microphone voice interaction without opening a browser.

---

## 4. Quick Start & Setup Guide

### 4.1 System Prerequisites
* **Python:** 3.12.x (64-bit)
* **Node.js:** 20+ LTS
* **Microsoft Visual C++ 2015–2022 Redistributable (x64)** *(Windows Mandatory: Prevents `WinError 1114` in PyTorch/Kokoro native C++ DLLs)*
* **MongoDB:** Community Server 7.x or 8.x listening on `mongodb://localhost:27017`

### 4.2 Backend Setup
```bash
cd backend

# Create and activate virtual environment (Windows)
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt

# Install Playwright browser binary
python -m playwright install chromium

# Create environment file
cp .env.example .env
# Fill in your GEMINI_API_KEY, OPENROUTER_API_KEY, etc.

# Run database migrations
python manage.py migrate

# Launch Daphne ASGI Server
daphne -b 0.0.0.0 -p 8000 setu.asgi:application
```

### 4.3 Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev -- --host
```
*Open `http://localhost:5173` on desktop or `http://<YOUR_LAN_IP>:5173/mobile` on your smartphone.*

### 4.4 Local Voice Loop (Terminal Only)
```bash
cd backend
.\venv\Scripts\activate
python listener.py
```

---

## 5. Environment Variables Reference (`backend/.env`)

```env
# Django Settings
DJANGO_SECRET_KEY=your-secure-django-secret-key
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,*

# MongoDB Configuration
MONGODB_HOST=mongodb://localhost:27017/setu_db
MONGODB_DB=setu_db

# Cloud LLM API Keys
GEMINI_API_KEY=your_google_ai_studio_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
NVIDIA_API_KEY=your_nvidia_nim_api_key

# Audio & Speech Settings
STT_MIN_LOGPROB=-1.50
WHISPER_MODEL_SIZE=large-v3-turbo
SETU_USER_NAME=User
```

---

## 6. Key Verified Metrics

| Metric | Measured Value | Implementation |
|---|---|---|
| **Tier 0 Fast Router Latency** | **< 0.3 s** | `fast_responses.py` regex matching |
| **Layer 1 LLM Timeout** | **10 s** | Google Gemini in `llm_agent.py` |
| **Layer 2 LLM Timeout** | **6 s** | OpenRouter in `llm_agent.py` |
| **Layer 3 LLM Timeout** | **5 s** | NVIDIA NIM in `llm_agent.py` |
| **Silero VAD Speech Threshold** | **0.35** | `core/ai/stt.py` |
| **STT Confidence Gate** | **−1.50 logprob** | Transcriptions below threshold are discarded |
| **Agent Memory Cap** | **50 checkpoints** | Per-thread eviction via `BoundedMemorySaver` |
| **Active Registered Tools** | **14 tools** | Registered in `core/agent/tools.py` |

---

## 7. Creator & Identity

Designed and created by **Dhairya Dave**.  
Distributed under the MIT License.
