# AI Developer Context & Boundaries (POOKIE Project)

**CRITICAL INSTRUCTION FOR ALL AI ASSISTANTS:** 
Read this document before writing any code, suggesting features, or proposing architectural changes for the POOKIE AI Agent project. If a user request contradicts these rules, you MUST ask for clarification rather than blindly implementing it.

## 1. Project Overview
POOKIE is a cross-platform, local-first AI personal agent. It emphasizes deep system integration, privacy (local processing), and a strict permission model.

## 2. Strict Hard Boundaries (Out of Scope)
Do **NOT** implement, suggest, or write code for the following features unless explicitly overridden by the user:
- ❌ **macOS or iOS support.** The target platforms are strictly Windows, Linux, and Android.
- ❌ **Third-party plugin marketplaces.**
- ❌ **Cloud-based STT/TTS as the default.** Local execution (Faster-Whisper/Kokoro) is the default. Cloud is only a fallback.
- ❌ **Multi-user or team enterprise features.** This is a personal agent.
- ❌ **Custom voice cloning.**
- ❌ **Smart Home / IoT** (HomeAssistant, Alexa, etc.) integrations.

## 3. Technology Enforcements
When writing code or setting up environments, strictly adhere to these technologies:
- **Core Language**: Python 3.11+
- **Wake Word Detection**: `openwakeword` (Do NOT use PyAudio/SpeechRecognition alone, and do NOT use cloud APIs for wake word).
- **Speech-to-Text (STT)**: `faster-whisper` (Do NOT default to OpenAI's Whisper API).
- **Text-to-Speech (TTS)**: `kokoro` or `piper-tts` (Do NOT use Google TTS, ElevenLabs, or pyttsx3). *Rule: Always write the agent's name as "Pookie" in system prompts, not "POOKIE", to prevent the TTS engine from spelling it out as an acronym.*
- **Agent Framework**: `langchain`
- **Backend API**: `Django` + `Django REST Framework` + `Django Channels` (for WebSockets).
- **Database**: `MongoDB` (Do NOT use PostgreSQL, MySQL, or SQLite).
- **Task Queue**: `Celery` + `Redis` (Do NOT use Python's built-in `threading` for background web tasks).
- **Desktop UI**: `React` + `Electron` + `TailwindCSS`
- **Mobile UI**: `React Native` (Android only)

## 4. Security & Permission Rules
- **No Silent Intrusions**: Never write scripts that bypass Windows UAC or Linux polkit.
- **Level 3 Permissions**: Actions like installing apps, modifying the registry, or managing background processes must ALWAYS pause execution and wait for explicit OS-level user approval.
- **Microphone Privacy**: Do NOT write code that records audio *before* the wake word is triggered. The microphone should only stream to memory in small chunks for wake word detection, and only begin recording for STT after the trigger.

## 5. Source of Truth Documentation
When in doubt, refer to the existing project documentation:
- **`PRD.md`**: For product goals, user personas, and high-level requirements.
- **`TRD.md`**: For technical architecture, API schemas, and component design.
- **`DATABASE_SCHEMA.md`**: For MongoDB collection structures.
- **`APP_FLOW.md`**: For UI state machines and user journeys.
- **`STEP_BY_STEP_GUIDE.md`**: For the exact order of implementation. Do NOT skip ahead to future phases.

## 6. Architecture Deviations (Phase 1 -> Phase 5)
- **Intent Classification**: The TRD (Section 3.3) specifies a fine-tuned DistilBERT model. For rapid prototyping in Phase 1, intent classification is temporarily handled by the LangChain ReAct agent (LLM). However, to ensure strict offline-first capabilities, the dedicated NLP model MUST be trained and implemented in Phase 5 to handle system-level commands locally.

## 6. Current Implementation Phase
Always check with the user to determine the current phase of development (as defined in `STEP_BY_STEP_GUIDE.md`). Do not prematurely optimize or build features from Phase 4 (Mobile App) if the project is currently in Phase 1 (Core AI Engine).
