from kokoro import KPipeline
import sounddevice as sd
import numpy as np
import io
import soundfile as sf
import base64

class TTSEngine:
    def __init__(self):
        print("Loading Kokoro TTS...")
        self.pipeline = KPipeline(lang_code='a') # 'a' is American English
        self.voice = 'af_heart' # Default high-quality American female voice
        print("Kokoro TTS loaded.")

    def speak(self, text: str):
        print(f"Setu (TTS): {text}")
        
        # We don't stream playback chunk-by-chunk anymore because it causes unnatural gaps.
        # Since our responses are ultra-short (1-2 sentences), we generate the full audio and play it seamlessly.
        generator = self.pipeline(
            text, voice=self.voice,
            speed=1.0
        )
        
        audio_chunks = []
        for i, (gs, ps, audio) in enumerate(generator):
            if audio is not None:
                audio_chunks.append(audio)
                
        if audio_chunks:
            full_audio = np.concatenate(audio_chunks)
            sd.play(full_audio, 24000) # Kokoro output sample rate is 24000
            sd.wait()

    def generate_base64(self, text: str) -> str:
        """Generates TTS audio and returns it as a Base64 encoded WAV string for WebSockets."""
        generator = self.pipeline(
            text, voice=self.voice,
            speed=1.0
        )
        
        audio_chunks = []
        for i, (gs, ps, audio) in enumerate(generator):
            if audio is not None:
                audio_chunks.append(audio)
                
        if not audio_chunks:
            return ""
            
        full_audio = np.concatenate(audio_chunks)
        
        # Convert numpy array to WAV bytes in memory
        wav_io = io.BytesIO()
        sf.write(wav_io, full_audio, 24000, format='WAV', subtype='PCM_16')
        wav_io.seek(0)
        
        # Encode to Base64 string
        return base64.b64encode(wav_io.read()).decode('utf-8')
