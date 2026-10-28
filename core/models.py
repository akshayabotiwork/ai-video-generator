from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# ==============================================================================
# 🎬 OPENREEL NATIVE TYPES (1:1 PARITY WITH OPENREEL CORE)
# ==============================================================================
OpenReelTransitionType = Literal[
    "crossfade",
    "dipToBlack",
    "dipToWhite",
    "wipe",
    "slide",
    "zoom",
    "push",
    "circleReveal",
    "blur",
    "whipPan",
    "radialWipe",
    "pixelate",
    "glitch",
    "blinds",
    "diamondReveal",
    "spin",
    "flip",
    "splitReveal",
    "flash",
    "filmBurn",
    "mosaic",
    "ripple",
    "pageTurn",
    "colorSplit",
    # Backward compatible aliases
    "dissolve",
    "fade",
    "iris",
]

OpenReelWipeDirection = Literal[
    "left", "right", "up", "down",
    "diagonal-tl", "diagonal-tr", "diagonal-bl", "diagonal-br"
]

OpenReelSlideDirection = Literal["left", "right", "up", "down"]

OpenReelIrisShape = Literal["circle", "rectangle", "diamond", "star"]

OpenReelLayerEffectType = Literal[
    "blur",
    "shadow",
    "glow",
    "brightness",
    "contrast",
    "saturation",
    "hue-saturation",
    "color-balance",
    "curves",
    "motion-blur",
    "radial-blur",
    "vignette",
    "grain",
    "film-grain",
    "chromatic-aberration"
]

OpenReelMotionStyle = Literal[
    "zoom_in",
    "zoom_out",
    "pan_left",
    "pan_right",
    "static"
]

class VisualCandidate(BaseModel):
    """Represents a candidate visual image/video discovered via SERP API or stock."""
    title: str = ""
    source: str = ""
    link: str = ""  # Destination web page link
    image_url: str = ""  # Direct high-res image or video link
    thumbnail_url: str = ""
    width: Optional[int] = None
    height: Optional[int] = None
    relevance_score: float = 0.0
    matched_entity: Optional[str] = None
    is_video: bool = False

class SceneData(BaseModel):
    """Represents a single segmented scene in the video storyboard."""
    scene_id: int
    narration_text: str = ""
    primary_entity: Optional[str] = ""
    action: Optional[str] = ""
    opponent_or_context: Optional[str] = ""
    temporal_anchor: Optional[str] = ""  # E.g. "2012", "Yesterday", "1969"
    search_query: str = ""
    secondary_queries: List[str] = Field(default_factory=list)
    visual_type_preference: Literal["image", "video", "auto"] = "auto"
    lower_third_headline: Optional[str] = ""
    category_tag: Optional[str] = "GENERAL"
    visual_category: Optional[str] = "dynamic_action"  # character_portrait, dynamic_action, symbolic_metaphor, wide_environment, artifact_detail
    focal_point: Optional[str] = "center"               # top_face, center, wide_horizon
    motion_style: OpenReelMotionStyle = "zoom_in"
    motion_speed: Optional[str] = "slow_dramatic"       # slow_dramatic, fast_punch, steady_pan
    chapter_marker: Optional[str] = ""                  # e.g. "ACT I: THE BEGINNING"
    transition_type: OpenReelTransitionType = "crossfade"
    transition_direction: Optional[str] = "left"        # e.g. "left", "right", "diagonal-tl"
    transition_duration: float = 0.5
    layer_effects: List[OpenReelLayerEffectType] = Field(default_factory=list)
    timeline_start: float = 0.0
    timeline_end: float = 0.0
    word_timestamps: List[dict] = Field(default_factory=list)
    selected_visual: Optional[VisualCandidate] = None
    visual_candidates: List[VisualCandidate] = Field(default_factory=list)
    local_media_path: Optional[str] = None
    all_media_paths: List[str] = Field(default_factory=list)
    local_audio_path: Optional[str] = None
    audio_duration: float = 0.0
    audio_offset: float = 0.0
    audio_volume: float = 1.0

class VideoProject(BaseModel):
    """Represents a complete news-video generation project."""
    project_id: str
    title: str
    raw_script: str
    category: str = "news"
    theme: str = "breaking_news"
    aspect_ratio: Literal["16:9", "9:16", "1:1"] = "16:9"
    voice: str = "en-US-GuyNeural"
    default_transition: str = "crossfade"
    transition_duration: float = 0.5
    max_shot_duration: float = 3.0  # Max seconds per image cut (from Motion settings)
    total_timeline_duration: float = 0.0
    include_subtitles: bool = True
    include_ticker: bool = False
    include_background_music: bool = True
    master_audio_path: Optional[str] = None
    soundbed_path: Optional[str] = None
    soundbed_volume: Optional[float] = None
    scenes: List[SceneData] = Field(default_factory=list)
    output_video_path: Optional[str] = None
    status: Literal["draft", "parsed", "media_selected", "rendering", "completed", "failed"] = "draft"
    error_message: Optional[str] = None
    progress_percent: int = 0

