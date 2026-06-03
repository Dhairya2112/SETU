import os
import sys

# Ensure the agent modules can be found
sys.path.append(os.path.join(os.path.dirname(__file__), 'core'))

from wake_word.detector import WakeWordDetector
from ai.stt import STTPipeline
from agent.llm_agent import POOKIEAgent
from ai.tts import TTSEngine

def main():
    print("--- Starting POOKIE Agent ---")
    
    # Initialize all components
    wake_word = WakeWordDetector()
    stt = STTPipeline()
    agent = POOKIEAgent()
    tts = TTSEngine()
    
    print("\n===============================================")
    print("POOKIE is now online and listening in the background.")
    print("Say 'Hey Jarvis' to activate (using Jarvis model for testing).")
    print("===============================================\n")
    
    try:
        is_first_interaction = True
        
        while True:
            # 1. Listen for wake word (blocks until detected)
            if wake_word.listen_for_wake_word():
                print("\n[!] WAKE WORD DETECTED [!]")
                
                if is_first_interaction:
                    tts.speak("Hello! I am Pookie. How can I help you today?")
                    is_first_interaction = False
                
                # Continuous conversation loop
                while True:
                    # 2. Capture audio command
                    audio_data = wake_word.capture_audio_dynamic()
                    
                    # 3. Speech to Text
                    print("Transcribing...")
                    text_command = stt.transcribe(audio_data)
                    print(f"USER: {text_command}")
                    
                    # Clean punctuation and check for exit commands
                    clean_command = text_command.lower()
                    for p in ".,!?":
                        clean_command = clean_command.replace(p, "")
                    clean_command = clean_command.strip()
                    
                    words = clean_command.split()
                    
                    # If empty, or a short phrase containing exit words
                    is_exit = False
                    if not clean_command:
                        is_exit = True
                    elif len(words) <= 3 and any(w in ["no", "nope", "bye", "goodbye", "thanks", "thank", "stop", "nothing"] for w in words):
                        is_exit = True
                        
                    if is_exit:
                        print("Ending conversation loop.")
                        tts.speak("Alright, I'll be here if you need me!")
                        break
                        
                    # 4. Agent Execution
                    print("Agent is thinking...")
                    response = agent.run(text_command)
                    
                    # 5. Text to Speech
                    tts.speak(response)
                    
                    # Follow up prompt
                    tts.speak("Anything else?")
                    print("\nListening for follow-up...")
                    
                print("\nReturning to idle listening state...")
                
    except KeyboardInterrupt:
        print("\nPOOKIE Shutting down.")

if __name__ == "__main__":
    main()
