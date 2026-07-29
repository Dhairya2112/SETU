# Setu (सेतु) — 1-Hour Crash Course & Presentation Guide

Welcome to the 1-hour crash course on **Setu**! This guide is designed to help you quickly understand the entire architecture, prepare for your presentation tomorrow, and confidently answer questions from your audience.

---

## 1. The Elevator Pitch (What to say first)
**"Setu (सेतु) is a local-first, privacy-native AI automation engine that bridges your Android phone and Windows laptop."**

Unlike standard chatbots (like ChatGPT) that just give you text, Setu is an **Agentic OS Assistant**. It doesn't just talk to you; it takes actions on your computer (opening apps, typing, clicking browsers, running terminal commands) while keeping all your sensitive audio and screenshots local. 

---

## 2. High-Level Architecture (The Tech Stack)

When explaining how it's built, break it down into these three pillars:

### A. The Backend (The Engine)
* **Framework:** Django + Django Channels (ASGI)
* **Why?** We needed robust HTTP routes for authentication, but more importantly, **WebSockets** (Django Channels) for real-time, low-latency streaming between the PC and the phone.
* **Database:** MongoDB (via MongoEngine). Used because agent logs and conversation states are highly unstructured and JSON-heavy.

### B. The Frontend (The Dashboard)
* **Framework:** React + Vite + TailwindCSS
* **Features:** A sleek, cyberpunk-inspired UI with a dynamic `100dvh` mobile layout, background neural mesh animations, and state management using Zustand.

### C. The AI Pipeline (The Brain & Mouth)
* **The Brain (LLM):** LangChain / LangGraph. We use a **3-Layer Resilience Model**:
  1. Primary: Google Gemini (High speed)
  2. Fallback: OpenRouter (Gemma)
  3. Final Fallback: NVIDIA NIM (Llama 3.1)
* **The Ears (STT):** Faster-Whisper. Transcribes speech to text locally on the machine so voice data never goes to the cloud.
* **The Mouth (TTS):** Kokoro TTS. Highly optimized, human-like voice synthesis that plays directly through the browser.

---

## 3. Core Features to Demo (The "Wow" Moments)

During your presentation, you should demonstrate these specific features:

### 🌟 Demo 1: Mobile-to-PC WebSockets (Cross-Device)
* **What to show:** Open the PC dashboard. Scan the QR code with your Samsung phone. Watch the PC dashboard instantly update to show `"Samsung Device Connected"`. 
* **How it works:** When the phone loads the page, it connects to a WebSocket room (`mobile-remote-session`). The Django backend reads the `sec-ch-ua-model` header to detect it's a Samsung, then broadcasts a `device_status` event via Redis/Channels to the PC UI.

### 🌟 Demo 2: Real-time Voice to OS Action
* **What to show:** Speak into the phone: *"Setu, open the calculator"* or *"Setu, search for the weather on DuckDuckGo"*. Watch the PC instantly execute the command.
* **How it works:**
  1. Phone records audio and sends base64 chunks over WebSockets.
  2. Django Backend decodes the audio and runs it through `Faster-Whisper`.
  3. Transcribed text goes to the `LangGraph` agent.
  4. The Agent realizes it needs to use the `open_application` or `web_search` tool.
  5. The Python backend physically opens the app on the host machine using OS-level commands (`subprocess` / `Playwright`).
  6. Setu replies back over WebSockets, and `Kokoro` generates voice audio saying *"Done."*

---

## 4. The "Secret Sauce" (Why your project is technically impressive)

If professors or engineers ask what makes this project special, hit them with these points:

1. **Centralized Model Pre-Loading (`pipeline.py`):** 
   Instead of loading heavy AI models (Whisper/Kokoro) every time a request comes in, we load them into memory exactly *once* during Django's boot cycle. This drops response latency from 4 seconds down to ~300ms.
2. **Audio Interpolation:** 
   Web browsers record audio at various sample rates (like 48kHz). Our WebSocket consumer uses `numpy` to instantly downsample raw PCM audio streams to 16kHz on the fly before feeding it to Whisper.
3. **Cancellation & Thread Safety (`state.py`):**
   If the AI is doing a long task (like scraping a website) and the user says *"Stop"*, we use Python threading Events to instantly kill the LangChain tool execution, proving it's a truly interruptible OS agent.

---

## 5. Potential Q&A (Be prepared for these!)

**Q: How do you handle security if it has access to the terminal?**
*Answer:* We implemented strict sandboxing in `safety.py`. The agent cannot access files outside the user's home directory, and any destructive command (like deleting files) triggers a UAC (User Access Control) prompt.

**Q: Does the phone process the AI models?**
*Answer:* No! The phone is just a "dumb terminal" (a PWA remote). It streams raw audio over the local network (LAN) to the PC. The PC's CPU/GPU does all the heavy lifting for Whisper and LangChain, which saves phone battery.

**Q: Why use WebSockets instead of REST APIs?**
*Answer:* REST APIs require polling and have HTTP overhead. To have a natural, interruptible conversation with an AI, we need full-duplex communication where the AI can stream words (TTS) back to the user the exact millisecond they are generated.

---

## 6. Your 1-Hour Homework
1. **Read through `backend/core/websockets/consumers.py`**: Understand how the `receive()` function handles incoming audio vs text.
2. **Look at `backend/core/agent/tools.py`**: See how functions like `open_application` or `navigate_browser` actually interact with Windows.
3. **Run the App**: Practice connecting your phone and saying 3 different commands perfectly so you don't stumble during the live demo. 

You're going to crush this presentation! Setu is a highly complex, multi-layered system that demonstrates full-stack expertise (React, Django, WebSockets, Local AI, OS Automation).
