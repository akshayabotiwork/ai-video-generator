# Re-export from modular core.audio package
from core.audio.mixer import AudioMixer, _resolve_audio_file

__all__ = ["AudioMixer", "_resolve_audio_file"]
