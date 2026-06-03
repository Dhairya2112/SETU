from kokoro import KPipeline
import sounddevice as sd

class TTSEngine:
    def __init__(self):
        print("Loading Kokoro TTS...")
        self.pipeline = KPipeline(lang_code='a') # 'a' is American English
        self.voice = 'af_heart' # Default high-quality American female voice
        print("Kokoro TTS loaded.")

    def speak(self, text: str):
        print(f"POOKIE (TTS): {text}")
        # Split text into sentences so it starts playing the first sentence immediately
        generator = self.pipeline(
            text, voice=self.voice,
            speed=1, split_pattern=r'(?<=[.!?])\s+'
        )
        for i, (gs, ps, audio) in enumerate(generator):
            sd.play(audio, 24000) # Kokoro output sample rate is 24000
            sd.wait()
