import os
import sys

# Append paths to match the runtime environment
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend', 'core'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'setu.settings')

# Initialize django
try:
    import django
    django.setup()
    print("Django initialized successfully.")
except Exception as e:
    print(f"Failed to initialize Django: {e}")

from agent.fast_responses import FastResponseRouter
from agent.tts_cache import TTSCache
from ai.tts import TTSEngine

def test_fast_response_router():
    print("\n--- Testing FastResponseRouter ---")
    router = FastResponseRouter()
    
    test_cases = [
        ("hey setu", "Dhairya", "en"),
        ("Namaste setu!", "Dhairya", "hi"),
        ("bye bye", "Dhairya", "en"),
        ("thanks setu!", "Dhairya", "en"),
        ("how are you doing today?", "Dhairya", "en"),
        ("kaise ho aap?", "Dhairya", "hi"),
        ("who are you?", "Dhairya", "en"),
        ("what is your name?", "Dhairya", "en"),  # shouldn't match Tier 0
        ("open chrome", "Dhairya", "en"),          # shouldn't match Tier 0
    ]
    
    for command, name, lang in test_cases:
        res = router.check(command, user_name=name, language=lang)
        if res:
            print(f"Command: '{command}' ({lang}) -> MATCHED: [{res.category}] '{res.text}'")
        else:
            print(f"Command: '{command}' ({lang}) -> PASSED (No match)")

def test_tts_cache():
    print("\n--- Testing TTSCache ---")
    cache = TTSCache()
    tts = TTSEngine()
    
    test_phrase = "Hey Dhairya! What can I do for you?"
    voice = "af_heart"
    
    print("Generating/fetching first time (should cache)...")
    t0 = os.times()[4]
    audio1 = cache.get_or_generate(test_phrase, voice, tts)
    t1 = os.times()[4]
    print(f"Time taken first time: {t1 - t0:.4f}s")
    print(f"Audio generated, size: {len(audio1)} chars")
    
    print("\nFetching second time (should hit cache)...")
    t2 = os.times()[4]
    audio2 = cache.get_or_generate(test_phrase, voice, tts)
    t3 = os.times()[4]
    print(f"Time taken second time: {t3 - t2:.4f}s")
    
    assert audio1 == audio2, "Cache mismatch!"
    print("Cache verification successful!")

if __name__ == "__main__":
    test_fast_response_router()
    try:
        test_tts_cache()
    except Exception as e:
        print(f"TTS Cache test failed/skipped: {e}")
