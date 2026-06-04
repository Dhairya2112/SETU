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
        import numpy as np
        
        # We don't stream playback chunk-by-chunk anymore because it causes unnatural gaps.
        # Since our responses are ultra-short (1-2 sentences), we generate the full audio and play it seamlessly.
        generator = self.pipeline(
            text, voice=self.voice,
            speed=1.0, split_pattern=r'(?<=[.!?])\s+'
        )
        
        audio_chunks = []
        for i, (gs, ps, audio) in enumerate(generator):
            if audio is not None:
                audio_chunks.append(audio)
                
        if audio_chunks:
            full_audio = np.concatenate(audio_chunks)
            sd.play(full_audio, 24000) # Kokoro output sample rate is 24000
            sd.wait()
