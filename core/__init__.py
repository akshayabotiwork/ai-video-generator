"""
Core Video Generation Architecture
Modular packages:
- core.search: Multi-tier visual search (Google Direct, DuckDuckGo, SerpAPI, Wikimedia)
- core.audio: EdgeTTS speech synthesis, AudioMixer, Whisper forced alignment
- core.video: FFmpeg Single-Pass composer, Lower-Third Graphics, Subtitle styling
- core.director: AI Script parsing, segmentation, storyboard directing
"""

from core.pipeline import NewsVideoPipeline
from core.models import VideoProject, SceneData, VisualCandidate

__all__ = [
    "NewsVideoPipeline",
    "VideoProject",
    "SceneData",
    "VisualCandidate"
]

