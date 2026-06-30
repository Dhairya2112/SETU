import numpy as np
import os
import psutil
import gc
import torch
from faster_whisper import WhisperModel

class STTPipeline:
    def __init__(self, model_size=None, device="cpu"):
        self.device = device
        self.model = None
        self.current_size = None
        
        # Load the model dynamically
        self.load_model(model_size)

    def _auto_detect_size(self) -> str:
        override = os.getenv("WHISPER_MODEL_SIZE")
        if override:
            return override
        
        # Auto-detect size based on system RAM
        total_ram_gb = psutil.virtual_memory().total / (1024 ** 3)
        return "large-v3-turbo" if total_ram_gb >= 12.0 else "small"

    def load_model(self, model_size=None):
        if not model_size:
            model_size = self._auto_detect_size()

        if self.current_size == model_size:
            return

        # 1. Unload previous model to free RAM
        if self.model:
            print(f"Unloading STT model ({self.current_size}) to free RAM...")
            del self.model
            self.model = None
            
            # Force garbage collection
            gc.collect()
            
            # Clear CUDA cache if applicable
            if self.device == "cuda" and torch.cuda.is_available():
                torch.cuda.empty_cache()
            print("Memory cleared successfully.")

        # 2. Load the new Whisper model
        print(f"Loading Faster-Whisper model ({model_size})...")
        self.model = WhisperModel(model_size, device=self.device, compute_type="int8")
        self.current_size = model_size
        print(f"Faster-Whisper model ({model_size}) loaded.")

    def transcribe(self, audio_data: np.ndarray, sample_rate=16000) -> tuple[str, str]:
        # audio_data should be float32 array
        
        # Bilingual prompt priming Whisper for terminology, names, and code-switching
        bilingual_prompt = (
            "Setu, open VS Code. Launch Google Chrome. Hey Setu, what time is it? "
            "मुझे आज की खबरें बताओ। रिमाइंड मी एट 6 PM. Volume up. Search for python. "
            "Aise tu, Setu."
        )
        
        segments, info = self.model.transcribe(
            audio_data, 
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(
                threshold=0.35, 
                min_speech_duration_ms=200,
                min_silence_duration_ms=400
            ),
            initial_prompt=bilingual_prompt,
            temperature=[0.0, 0.2, 0.4]
        )
        text = " ".join([segment.text for segment in segments]).strip()
        
        # Phonetic correction for misheard "Setu" wake word variations (Whisper STT limits)
        lower = text.lower().strip()
        misheard_prefixes = [
            'hey say to', 'hey set to', 'hey c2', 'hey c two', 
            'hey seytu', 'hey sato', 'hey sito', 'hey statu',
            'hey center', 'hey sentry', 'hey satu', 'hey seutu', 
            'hey seeto', 'hey seetoo', 'hey sheto', 'hey sheeto', 
            'hey zeto', 'hey say two', 'hey set two', 'hey safe to', 
            'hey step to', 'hey send to', 'hey aise tu', 'aise tu', 
            'hey ai setu', 'hey ae setu', 'hey aye setu', 'hey ai se tu', 
            'hey ae se tu', 'hey aye se tu'
        ]
        
        matched_prefix = next((p for p in misheard_prefixes if lower.startswith(p)), None)
        if matched_prefix:
            import re
            text = re.sub(f"^{matched_prefix}", "hey setu", text, flags=re.IGNORECASE)
        else:
            single_name_mishears = [
                'say to', 'set to', 'c2', 'c two', 'seytu', 'sato', 'sito', 
                'statu', 'center', 'sentry', 'satu', 'seutu', 'seeto', 
                'seetoo', 'sheto', 'sheeto', 'zeto', 'say two', 'set two', 
                'safe to', 'step to', 'send to', 'aise tu', 'ai setu', 
                'ae setu', 'aye setu', 'ai se tu', 'ae se tu', 'aye se tu', 
                'aise'
            ]
            if lower in single_name_mishears:
                text = "setu"
                    
        return text, info.language
