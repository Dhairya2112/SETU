# Setu Debugging & Polish Plan

This plan addresses the three core issues you reported to ensure a robust pipeline, correct frontend syncing, and natural voice responses.

## 1. Pipeline Stability (Preventing Explosions)
**Goal:** Ensure the pipeline is resilient against network timeouts, LLM API failures, and rate limits without crashing the backend or locking the frontend.
*   **Current State:** The backend has a 3-layer LLM fallback, but if the final synthesis step fails (or if an unexpected error occurs during streaming), the backend sends a `"failed"` status or an error string and abruptly ends.
*   **Action Plan:**
    *   Review `tasks.py` and `llm_agent.py` to ensure all exceptions are caught and gracefully communicated to the frontend.
    *   Ensure the WebSocket connection is never forcefully dropped on error, but instead sends a clean fallback TTS (e.g., "Sorry, I ran into an error") so the interaction completes naturally.

## 2. Syncing Task Stream with TTS (Frontend)
**Goal:** Keep the "task stream" (active agent visual state) open until Setu actually *finishes* speaking the audio.
*   **Current State:** In `tasks.py`, the backend sends the full audio payload (`chunk_type: 'audio'`) and then IMMEDIATELY sends `chunk_type: 'status', message: 'done'`. 
*   **The Issue:** The frontend receives `"done"` instantly and might reset the UI (or close the task view), even though the browser's `<audio>` player is still playing a 10-second response.
*   **Action Plan:**
    *   Modify `useAgentSocket.js` in the frontend: instead of treating the `done` status as the absolute end of the interaction, we will tie the true "done" state to the `audio.onended` event. 
    *   The UI will only reset/close the stream when `isSpeaking` becomes `false` AND `activeStatus` is `'done'`.

## 3. Natural TTS (Removing Markdown Symbols)
**Goal:** Stop Kokoro TTS from reading robotic markdown characters like `*`, `#`, or `_`.
*   **Current State:** The LLM often generates Markdown (like `**bold**` or `* item`), and we pass this raw string directly to `tts_engine.generate_base64()`. Kokoro literally speaks the words "asterisk asterisk bold asterisk asterisk".
*   **Action Plan:**
    *   Update `backend/core/ai/tts.py` to include a text-cleaning regex before passing the string to the Kokoro pipeline.
    *   We will strip standard Markdown symbols (`*`, `#`, `_`, `[`, `]`, `` ` ``) so Setu only speaks the natural words.

## 4. Note on Hindi Accent (Whisper vs Kokoro)
You mentioned: *"which faster whisper model are we using cause i dont like the accent when it is speqaking hindi"*
*   **Clarification:** 
    *   **Faster-Whisper** is only used for **listening** (Speech-to-Text). We are currently using the `small` multilingual model for that.
    *   **Kokoro** is what is actually **speaking** (Text-to-Speech). The Hindi accent you are hearing is from the Kokoro Hindi voices (`hf_alpha` for female, `hm_omega` for male). 
*   **Action Plan:** Since Kokoro's Hindi data is somewhat limited, it has a distinct accent. We can't easily swap the TTS model without increasing latency or hardware requirements, but cleaning the text (removing symbols) will immediately make the Hindi sound much more natural and less confused by English punctuation.

---
**Status:** Ready for your review. Let me know if you want to proceed with executing these fixes!
