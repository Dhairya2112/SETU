import pyaudio
import numpy as np
import torch
import time
from openwakeword.model import Model

class WakeWordDetector:
    def __init__(self, chunk_size=1280, sample_rate=16000):
        self.chunk_size = chunk_size
        self.sample_rate = sample_rate
        # For Phase 1 testing, we use a pre-trained openwakeword model.
        # We use 'hey_jarvis' as a temporary proxy until the custom 'Hey Setu' model is trained.
        print("Loading OpenWakeWord model...")
        self.oww_model = Model(wakeword_models=['hey_jarvis'], inference_framework='onnx')
        print("OpenWakeWord model loaded. Listening for 'Hey Setu' (using Jarvis model as a proxy)...")
        
        print("Loading Silero VAD (PyTorch)...")
        self.vad_model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad', model='silero_vad')
        print("Silero VAD loaded.")
        
        self.audio = pyaudio.PyAudio()
        self.stream = self.audio.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=self.chunk_size
        )

    def listen_for_wake_word(self):
        while True:
            # Get audio
            audio_chunk = np.frombuffer(self.stream.read(self.chunk_size, exception_on_overflow=False), dtype=np.int16)
            
            # Feed to openwakeword model
            prediction = self.oww_model.predict(audio_chunk)
            
            # Check if any model predicted the wake word (score > threshold)
            for mdl in self.oww_model.prediction_buffer.keys():
                scores = list(self.oww_model.prediction_buffer[mdl])
                if scores:
                    current_score = scores[-1]
                    if current_score > 0.05: # Print anything remotely close
                        print(f"Jarvis Score: {current_score:.3f}")
                    if current_score > 0.06: # Even lower threshold for easier activation!
                        return True

    def close(self):
        """Release audio resources."""
        try:
            if hasattr(self, 'stream') and self.stream:
                self.stream.stop_stream()
                self.stream.close()
        except Exception:
            pass
        try:
            if hasattr(self, 'audio') and self.audio:
                self.audio.terminate()
        except Exception:
            pass

    def __del__(self):
        self.close()

    def capture_audio_dynamic(self, max_duration=15, silence_duration=0.7) -> np.ndarray:
        print("Listening (VAD active)...")
        vad_chunk_size = 512
        frames = []
        silence_start = None
        has_spoken = False
        
        start_time = time.time()
        
        while True:
            # Check timeout
            if time.time() - start_time > max_duration:
                break
                
            data = self.stream.read(vad_chunk_size, exception_on_overflow=False)
            audio_chunk = np.frombuffer(data, dtype=np.int16)
            frames.append(audio_chunk)
            
            # VAD inference
            audio_tensor = torch.from_numpy(audio_chunk.astype(np.float32) / 32768.0)
            speech_prob = self.vad_model(audio_tensor, self.sample_rate).item()
            
            if speech_prob > 0.5:
                has_spoken = True
                silence_start = None
            else:
                if has_spoken:
                    if silence_start is None:
                        silence_start = time.time()
                    elif time.time() - silence_start > silence_duration:
                        print("End of speech detected (700ms silence).")
                        break
                else:
                    # If they never start speaking, we also want to eventually time out, 
                    # but maybe give them 5 seconds to start
                    if time.time() - start_time > 5:
                        print("No speech detected.")
                        break

        audio_data = np.concatenate(frames)
        audio_float = audio_data.astype(np.float32) / 32768.0
        return audio_float
