"""
Setu TTS Audio Cache (Step 14.6.2)

Pre-generates and caches TTS audio for common Tier 0 fast responses.
Eliminates 1–2s of TTS generation latency for cached phrases.

Cache is built lazily — audio is generated on first request for a given
(text, voice) pair and stored in memory for all subsequent requests.
"""

import logging
import threading
from typing import Optional

logger = logging.getLogger('core.agent')


class TTSCache:
    """
    In-memory cache for pre-generated TTS audio (base64 WAV strings).
    Thread-safe via a lock (safe for concurrent background threads).

    Usage:
        cache = TTSCache()
        audio = cache.get_or_generate("Hello!", "af_heart", tts_engine)
    """

    def __init__(self):
        self._cache = {}   # key: (text, voice) → value: base64 audio string
        self._lock = threading.Lock()

    def get(self, text: str, voice: str) -> Optional[str]:
        """Get cached audio if available. Returns None on cache miss."""
        with self._lock:
            return self._cache.get((text, voice))

    def put(self, text: str, voice: str, audio_b64: str) -> None:
        """Store a base64 audio string in the cache."""
        with self._lock:
            self._cache[(text, voice)] = audio_b64

    def get_or_generate(
        self,
        text: str,
        voice: str,
        tts_engine,
        speed: float = 1.0
    ) -> str:
        """
        Return cached TTS audio, or generate + cache + return.

        Args:
            text:       The text to synthesize.
            voice:      Kokoro voice ID (e.g. 'af_heart', 'hm_omega').
            tts_engine: A TTSEngine instance with generate_base64().
            speed:      TTS speed multiplier (default 1.0).

        Returns:
            Base64-encoded WAV audio string. Empty string on failure.
        """
        cached = self.get(text, voice)
        if cached is not None:
            logger.debug("TTS cache hit: '%s' [voice=%s]", text[:40], voice)
            return cached

        # Cache miss — generate, cache, and return
        try:
            audio_b64 = tts_engine.generate_base64(text, voice=voice, speed=speed)
            if audio_b64:
                self.put(text, voice, audio_b64)
                logger.debug("TTS cached (new): '%s' [voice=%s]", text[:40], voice)
            return audio_b64 or ""
        except Exception as e:
            logger.warning("TTS cache generation failed for '%s': %s", text[:40], e)
            return ""

    @property
    def size(self) -> int:
        """Number of entries currently in cache."""
        with self._lock:
            return len(self._cache)

    def clear(self) -> None:
        """Clear all cached entries."""
        with self._lock:
            self._cache.clear()

    def warm_cache(self, tts_engine, user_names=["there"], voices=['af_heart', 'hf_alpha']):
        """
        Pre-warms the cache for common Tier 0 fast responses on startup.
        Runs in a background thread to prevent blocking server boot.
        """
        def _warm():
            logger.info("Starting TTS cache pre-warming...")
            try:
                from core.agent.fast_responses import _PATTERNS
            except ImportError:
                try:
                    from agent.fast_responses import _PATTERNS
                except ImportError as e:
                    logger.warning("Could not import _PATTERNS for TTS cache warming: %s", e)
                    return

            warmed_count = 0
            for category, data in _PATTERNS.items():
                # English templates
                for template in data.get('responses', []):
                    for name in user_names:
                        try:
                            text = template.format(name=name)
                            self.get_or_generate(text, 'af_heart', tts_engine)
                            warmed_count += 1
                        except Exception as e:
                            logger.warning("Failed to warm cache for template '%s': %s", template, e)
                # Skipped Hindi warming by default to save RAM on startup
                # The Hindi pipeline will load lazily if a user requests it.
            logger.info("TTS cache pre-warming complete. Generated %d response samples.", warmed_count)

        threading.Thread(target=_warm, daemon=True).start()
