import os
import sys
import uuid

# Ensure the agent modules can be found
sys.path.append(os.path.join(os.path.dirname(__file__), 'core'))

from wake_word.detector import WakeWordDetector
from ai.stt import STTPipeline
from agent.llm_agent import SetuAgent
from ai.tts import TTSEngine
from agent.fast_responses import FastResponseRouter

def main():
    print("--- Starting Setu Agent ---")

    # Initialize all components
    wake_word = WakeWordDetector()
    stt = STTPipeline()
    agent = SetuAgent()
    tts = TTSEngine()
    fast_router = FastResponseRouter()

    # Stable session IDs for the local voice loop.
    # Using "local" as user_id — permissions.py allows L1 tools without a DB user.
    LOCAL_USER_ID = "local"
    session_conversation_id = str(uuid.uuid4())  # New conversation per listener restart

    print("\n===============================================")
    print("Setu is now online and listening in the background.")
    print("Say 'Hey Setu' to activate (using 'Hey Jarvis' wake word model for testing).")
    print("===============================================\n")

    try:
        is_first_interaction = True

        while True:
            # 1. Listen for wake word (blocks until detected)
            if wake_word.listen_for_wake_word():
                print("\n[!] WAKE WORD DETECTED [!]")

                if is_first_interaction:
                    tts.speak("Hello! I am Setu. How can I help you today?")
                    is_first_interaction = False

                # Continuous conversation loop
                silence_count = 0
                detected_lang = 'en'
                while True:
                    # 2. Capture audio command
                    audio_data = wake_word.capture_audio_dynamic()

                     # 3. Speech to Text
                    print("Transcribing...")
                    text_command, detected_lang = stt.transcribe(audio_data)
                    print(f"USER ({detected_lang}): {text_command}")

                    # Clean punctuation and check for exit commands
                    clean_command = text_command.lower()
                    for p in ".,!?":
                        clean_command = clean_command.replace(p, "")
                    clean_command = clean_command.strip()

                    words = clean_command.split()

                    # If empty, or a short phrase containing exit words
                    is_exit = False
                    if not clean_command:
                        silence_count += 1
                        if silence_count >= 2:
                            is_exit = True
                        else:
                            print("No speech detected. Prompting user...")
                            voice = 'hf_alpha' if detected_lang == 'hi' else 'af_heart'
                            tts.speak("Are you still there?", voice=voice)
                            continue
                    elif len(words) <= 3 and any(w in ["no", "nope", "bye", "goodbye", "thanks", "thank", "stop", "nothing"] for w in words):
                        is_exit = True
                    else:
                        silence_count = 0

                    if is_exit:
                        print("Ending conversation loop.")
                        tts.speak("Alright, I'll be here if you need me!")
                        break

                    # Determine voice based on detected language
                    voice = 'af_heart'
                    if detected_lang == 'hi':
                        voice = 'hf_alpha'

                    # 3.5. Tier 0 fast-path — instant response for greetings, etc.
                    fast = fast_router.check(text_command, user_name="User", language=detected_lang)
                    if fast:
                        print(f"[Tier 0 — {fast.category}] {fast.text}")
                        tts.speak(fast.text, voice=voice)
                        print("\nListening for follow-up...")
                        continue

                    # 4. Agent Execution — pass user_id and conversation_id
                    print("Agent is thinking...")
                    response = agent.run(
                        text_command,
                        user_id=LOCAL_USER_ID,
                        conversation_id=session_conversation_id
                    )

                    # 5. Text to Speech
                    tts.speak(response, voice=voice)

                    # Follow up prompt
                    if not response.strip().endswith('?'):
                        tts.speak("Anything else?", voice=voice)

                    print("\nListening for follow-up...")

                print("\nReturning to idle listening state...")

    except KeyboardInterrupt:
        print("\nSetu Shutting down.")

if __name__ == "__main__":
    main()
