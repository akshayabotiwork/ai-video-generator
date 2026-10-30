# Re-export from modular core.video package
from core.video.composer import VideoComposer, VALID_XFADE_TRANSITIONS, _resolve_img_path

__all__ = ["VideoComposer", "VALID_XFADE_TRANSITIONS", "_resolve_img_path"]
