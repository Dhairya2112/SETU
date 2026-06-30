from kokoro import KPipeline
import sounddevice as sd
import numpy as np
import io
import soundfile as sf
import base64

class TTSEngine:
    def __init__(self):
        print("Loading Kokoro TTS...")
        self.pipelines = {
            'a': KPipeline(lang_code='a'), # American English
            'h': KPipeline(lang_code='h')  # Hindi
        }
        self.default_voice = 'af_heart'
        print("Kokoro TTS loaded.")

    def _get_pipeline(self, voice: str):
        lang = 'a'
        if voice and voice.startswith('h'):
            lang = 'h'
        return self.pipelines.get(lang, self.pipelines['a'])

    def speak(self, text: str, voice: str = 'af_heart', speed: float = 1.0):
        print(f"Setu (TTS): {text}")
        pipeline = self._get_pipeline(voice)
        generator = pipeline(
            text, voice=voice,
            speed=speed
        )
        
        audio_chunks = []
        for i, (gs, ps, audio) in enumerate(generator):
            if audio is not None:
                audio_chunks.append(audio)
                
        if audio_chunks:
            full_audio = np.concatenate(audio_chunks)
            sd.play(full_audio, 24000) # Kokoro output sample rate is 24000
            sd.wait()

    def generate_base64(self, text: str, voice: str = 'af_heart', speed: float = 1.0) -> str:
        """Generates TTS audio and returns it as a Base64 encoded WAV string for WebSockets."""
        pipeline = self._get_pipeline(voice)
        generator = pipeline(
            text, voice=voice,
            speed=speed
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
