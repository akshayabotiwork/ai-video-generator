# Re-export from modular core.audio package
from core.audio.aligner import align_custom_audio, auto_segment_audio, get_whisper_model

__all__ = ["align_custom_audio", "auto_segment_audio", "get_whisper_model"]
