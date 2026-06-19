import numpy as np
from faster_whisper import WhisperModel

class STTPipeline:
    def __init__(self, model_size="small.en", device="cpu"):
        print(f"Loading Faster-Whisper model ({model_size})...")
        self.model = WhisperModel(model_size, device=device, compute_type="int8")
        print("Faster-Whisper model loaded.")

    def transcribe(self, audio_data: np.ndarray, sample_rate=16000) -> str:
        # audio_data should be float32 array
        segments, info = self.model.transcribe(audio_data, beam_size=5)
        text = " ".join([segment.text for segment in segments]).strip()
        
        # Phonetic correction for misheard "Setu" wake word variations (Whisper STT limits)
        lower = text.lower().strip()
        misheard_prefixes = [
            'hey say to', 'hey set to', 'hey c2', 'hey c two', 
            'hey seytu', 'hey sato', 'hey sito', 'hey statu',
            'hey center', 'hey sentry'
        ]
        
        matched_prefix = next((p for p in misheard_prefixes if lower.startswith(p)), None)
        if matched_prefix:
            import re
            text = re.sub(f"^{matched_prefix}", "hey setu", text, flags=re.IGNORECASE)
        else:
            single_name_mishears = ['say to', 'set to', 'c2', 'c two', 'seytu', 'sato', 'sito', 'statu', 'center', 'sentry']
            if lower in single_name_mishears:
                text = "setu"
                    
        return text
