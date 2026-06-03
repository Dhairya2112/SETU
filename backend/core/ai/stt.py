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
        text = " ".join([segment.text for segment in segments])
        return text.strip()
