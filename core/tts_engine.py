# Re-export from modular core.audio package
from core.audio.tts import TTSEngine, _normalize_token

__all__ = ["TTSEngine", "_normalize_token"]
