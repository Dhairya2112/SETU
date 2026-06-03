# POOKIE — AI Agent Project Blueprint

This document outlines the architecture, technology stack, security model, and roadmap for **POOKIE**, a cross-platform AI agent designed to interact with users via voice and text, capable of executing tasks across various operating systems.

---

## 1. Technology Stack

### 🧠 AI / ML Engine
*   **PyTorch**: Deep learning framework for NLP, Wake-Word Detection, Intent Classification.
*   **Faster-Whisper**: Speech-to-Text. Optimized Whisper engine for low-end devices, runs completely offline.
*   **Transformers (HuggingFace)**: NLP Pipelines. Pre-trained LLM pipelines for understanding user intent & context.
*   **LangChain**: Agent Orchestration. Chains together tools, memory, and reasoning for agent behavior.
*   **OpenWakeWord**: Wake Word Detection. Always-listening open-source, lightweight model that activates on "Hey POOKIE".
*   **Kokoro / Piper TTS**: Text-to-Speech. Converts AI responses back to natural voice output.

### ⚙️ Backend
*   **Python**: Core Language. Primary language for AI logic, system APIs, background service.
*   **Django**: Web Framework. REST API server, user management, request routing, admin panel.
*   **Django REST Framework**: API Layer. Exposes all AI agent capabilities as RESTful endpoints.
*   **Celery + Redis**: Task Queue. Async background tasks — command processing, scheduled tasks, reminders.
*   **WebSockets (Django Channels)**: Real-time Comm. Live streaming of AI responses, real-time command feedback to frontend.
*   **MongoDB**: Database. Stores user profiles, conversation history, preferences, command logs.

### 🖥️ Frontend / Desktop App
*   **React.js**: UI Framework. Interactive dashboard, settings, conversation history, live visualizer.
*   **Electron.js**: Desktop Wrapper. Wraps React app into native Windows/Linux desktop application.
*   **React Native**: Mobile App. Android mobile version of POOKIE with native voice access.
*   **TailwindCSS**: Styling. Rapid UI styling, dark mode, responsive design system.
*   **Socket.io / WS Client**: Real-time UI. Live response streaming, waveform animations, status indicators.
*   **Framer Motion**: Animations. Smooth UI transitions, AI thinking animations, voice visualizer.

### 🔐 Auth & Deployment
*   **OAuth 2.0**: Authentication. Google, GitHub, Microsoft login. Secure token-based auth flow.
*   **JWT Tokens**: Session Management. Stateless auth tokens for API calls, refresh token rotation.
*   **Firebase**: Mobile Deployment. Firebase Hosting for web, Push Notifications, Analytics.
*   **Docker**: Containerization. Packages Python backend + models into portable containers.
*   **NSIS / Electron Builder**: Desktop Installer. Creates .exe installer for Windows, .apk for Android.

---

## 2. Architecture Flow

How POOKIE processes a command from start to finish:

1.  **Wake Word Detection**: A tiny AI model (OpenWakeWord) runs continuously in background at near-zero CPU usage, listening ONLY for the trigger phrase "Hey POOKIE". Nothing else is recorded.
2.  **Voice Capture & STT**: Once activated, the microphone records the command. Faster-Whisper converts speech to text locally on-device with high performance.
3.  **Intent Classification**: The text is analyzed by a fine-tuned NLP model to understand WHAT the user wants: open app, search web, set reminder, answer question, control system, etc.
4.  **Agent Execution**: LangChain agent selects the right TOOL to execute: web search, file manager, app launcher, calendar API, math, code execution, etc.
5.  **Response Generation**: An LLM (Groq Cloud API) generates a natural language response based on the execution result. Response is streamed via WebSocket to the frontend UI in real-time.
6.  **Voice Output (TTS)**: The text response is converted to speech using a TTS engine and played through speakers. UI shows animated waveform and the response text simultaneously.

---

## 3. System Access Levels (Security & Permissions)

POOKIE requires different levels of system access depending on the requested action.

*   **Level 1 — Basic (Always Granted)**
    *   Microphone Access, Speaker/TTS Output, Internet Access, App's Own Storage, OS Notifications. (Low/No Risk)
*   **Level 2 — Elevated (User Grants on Setup)**
    *   Open Apps/Files, Read/Write User's Documents, System Info, Browser Control, Clipboard, Screen Capture. (Medium Risk - Requires explicit user permission).
*   **Level 3 — Admin (Explicit Consent Required)**
    *   Install/Uninstall Apps, Registry Access (Windows), Camera Access, Background Process Management. (High Risk - Requires UAC or explicit OS prompt).
*   **Level 4 — NEVER DO (Illegal / Unethical)**
    *   Keylogging, Remote Desktop without consent, Accessing other users' files, Sending user data without consent. (Extreme Risk - Strictly prohibited).

---

## 4. Frontend vs Backend Ratio

The development effort and system logic are distributed as follows:

*   **Backend (70%)**
    *   AI Model Training & Inference (20%)
    *   Wake Word & STT Pipeline (15%)
    *   LangChain Agent + Tool System (15%)
    *   System API Integration Layer (10%)
    *   Django REST API + WebSockets (5%)
    *   MongoDB Data Layer (5%)
*   **Frontend (30%)**
    *   Dashboard & Conversation UI (10%)
    *   Settings & Permissions Panel (7%)
    *   Voice Visualizer & Animations (5%)
    *   Mobile App (React Native) (5%)
    *   Auth Flow (Login/OAuth) (3%)

---

## 5. Supported Platforms

POOKIE is designed to be cross-platform:

*   **Windows**: Delivered via Electron `.exe` installer. Uses Background service via Task Scheduler and UAC prompts for elevated permissions.
*   **Android**: Delivered via React Native `.apk` (Play Store). Uses a foreground service to stay alive and Android Accessibility Services for deeper control.
*   **Linux**: Delivered via AppImage or `.deb` package. Uses `systemd` for background daemon processes.
*   **Web (Landing Page)**: A static marketing website hosted on Firebase/Vercel that explains the permission model and provides download links for all platforms.

*(Note: macOS and iOS are explicitly out of scope for the current phase).*

---

## 6. Project Roadmap

*   **Phase 1: Core AI Engine (2–3 months)**
    *   Train/fine-tune wake word model, integrate Faster-Whisper STT, build basic intent classifier, set up LangChain agent framework, basic TTS output.
*   **Phase 2: Backend & APIs (2–3 months)**
    *   Django + DRF setup, MongoDB schema design, WebSocket implementation, OAuth + JWT auth, System tool integrations.
*   **Phase 3: Desktop App (Windows) (1–2 months)**
    *   Electron wrapper setup, React dashboard UI, background service + tray icon, Windows installer build, permission flow.
*   **Phase 4: Mobile App (Android) (2–3 months)**
    *   React Native setup, Android foreground service, mobile voice pipeline, Firebase integration, Play Store submission.
*   **Phase 5: Polish & Deploy (1–2 months)**
    *   UI/UX refinement, security audit, Firebase deployment, Docker containerization, beta testing.
