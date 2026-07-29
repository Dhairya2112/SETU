# Setu Deep Dive: Technology Stack & Total Data Flow

This document is your master cheat sheet for the **"Why"** and **"How"** of the Setu project. It breaks down every major library, why we chose it over alternatives, and maps out the exact sequence of events when a user issues a command.

---

## Part 1: Technologies — The Hows and Whys

### 1. Django & Django Channels (The Backend Hub)
* **Why:** We needed a Python backend because all the best AI and machine learning libraries (Whisper, LangChain, Kokoro) are built for Python. However, standard Django is synchronous and relies on HTTP requests. AI assistants need constant streaming (audio chunks, typing indicators). 
* **How:** **Django Channels** upgrades Django to ASGI (Asynchronous Server Gateway Interface), allowing us to use **WebSockets**. This gives us a persistent, two-way connection. We use Channels' `group_send` feature to easily broadcast messages from the mobile phone directly to the PC UI.

### 2. LangChain & LangGraph (The AI Brain)
* **Why:** An LLM (like Gemini or Llama) is just a text generator. To make it an "Agent", it needs to be able to *think* and *act*. **LangChain** provides the framework to turn Python functions (like `open_application`) into tools the LLM can understand. **LangGraph** models the AI as a state machine, managing the cyclic loop of (Thought → Tool Execution → Observation → Final Response).
* **How:** In `llm_agent.py`, we define our AI and give it access to `ALL_TOOLS`. When the user asks for the weather, LangGraph pauses the conversation, executes our custom Python script to fetch the weather, and feeds the result back to the LLM so it can answer the user.

### 3. Zustand (Frontend State Management)
* **Why:** In React, passing data (like authentication tokens or the active conversation ID) down through multiple layers of components is messy (Prop Drilling). Redux is too heavy and requires too much boilerplate. The Context API causes unnecessary re-renders. **Zustand** is a tiny, blazing-fast state manager.
* **How:** We use `useAppStore.js` to create a global store. Any component (like the `TitleBar` or `App` router) can instantly read or update the `token` without complicated setup. It also automatically syncs with `localStorage` to keep the user logged in.

### 4. Faster-Whisper (Speech-to-Text / STT)
* **Why:** We needed Setu to understand voice locally to preserve privacy. Standard OpenAI Whisper is too slow to run on a CPU for real-time conversation. **Faster-Whisper** uses the CTranslate2 engine, which provides a 4x speedup, allowing real-time transcription entirely on the local machine.
* **How:** It lives in `pipeline.py` as a singleton (loaded into RAM only once when the server starts). It receives audio arrays from the WebSocket and instantly transcribes them.

### 5. Kokoro (Text-to-Speech / TTS)
* **Why:** Classic Python TTS libraries (like `pyttsx3`) sound like robotic 1990s computers. Cloud TTS (like ElevenLabs) costs money and requires an internet connection. **Kokoro** is a lightweight, state-of-the-art local TTS model that sounds incredibly human.
* **How:** Once the LLM generates a text response, it is passed to Kokoro, converted into an audio waveform, and sent back over the WebSocket to play in the browser.

### 6. Playwright (Browser Automation)
* **Why:** If the user asks Setu to "Go to Wikipedia and read the first paragraph", standard Python requests (`requests` library) often fail because modern websites rely heavily on JavaScript. **Playwright** actually opens a headless browser, renders the JavaScript, and allows Setu to click buttons and read text exactly like a human would.
* **How:** Registered as a set of tools in `browser.py` (`navigate_browser`, `get_page_content`).

---

## Part 2: The Total Final Flow (End-to-End)

Here is exactly what happens under the hood when a user speaks into their phone: *"Setu, open the calculator."*

### Step 1: Frontend Audio Capture (React)
The user presses the microphone button on the `MobileChat.jsx` page. The `useAudioAnalyser` hook accesses the phone's microphone. It records the audio, converts it to base64 chunks, and streams it directly over the open **WebSocket** connection to the PC.

### Step 2: WebSocket Ingestion (Django Channels)
The `AgentStreamConsumer` (in `consumers.py`) receives the base64 audio.
* **The "Why":** Audio sample rates vary by device (phones usually record at 48kHz). Faster-Whisper specifically requires 16kHz audio.
* **The "How":** The backend uses `NumPy` and `SoundFile` to decode the base64, convert stereo to mono, and instantly downsample it to 16kHz in RAM.

### Step 3: Transcription (Faster-Whisper)
The clean 16kHz audio array is passed to the `STTPipeline`. The model transcribes the audio and returns the text: *"open the calculator"*.
* The backend immediately shoots a WebSocket message back to the UI saying `chunk_type: text_user` so the user sees their transcribed text appear in the chat bubble instantly.

### Step 4: Agent Orchestration (LangGraph & Python Threads)
The text is passed to `process_agent_command` in `pipeline.py`. 
* **The "Why":** If we run heavy AI tasks on the main WebSocket thread, the server will freeze, and the UI will disconnect.
* **The "How":** We spawn an `asyncio.to_thread` background worker. This allows the AI to think while the WebSocket remains open to send "Executing Task..." loading statuses.

### Step 5: LLM Reasoning & Tool Execution (LangChain)
LangGraph sends the prompt to the LLM (Gemini Flash Lite).
1. The LLM reads its System Prompt and realizes it has an OS tool called `open_application`.
2. It pauses text generation and outputs a JSON tool call: `{"name": "open_application", "arguments": {"app_name": "calc"}}`.
3. LangChain intercepts this, finds our custom Python function in `tools.py`, and executes `subprocess.Popen("calc")`. The calculator pops up on the Windows screen.
4. The tool returns a success message back to the LLM.

### Step 6: Final Response Generation
Now that the tool succeeded, the LLM generates its final conversational response: *"I have opened the calculator for you."*

### Step 7: Voice Synthesis (Kokoro)
Before sending the text to the user, the backend passes *"I have opened the calculator for you"* to the Kokoro TTS engine. Kokoro generates a human-like audio file (base64 encoded).

### Step 8: Frontend Rendering & Playback
The backend sends two final WebSocket chunks:
1. `chunk_type: text` containing the text response.
2. `chunk_type: audio` containing the base64 voice file.

The React frontend (`useAgentSocket.js`) receives these. It adds the text to the chat history array (causing the UI to re-render the chat bubble), and immediately plays the base64 audio through the browser's native Audio API.

**Total execution time:** ~2 to 3 seconds.
