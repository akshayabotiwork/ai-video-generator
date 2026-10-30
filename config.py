import os
import shutil
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ==============================================================================
# 🔑 API KEYS & CREDENTIALS (Loaded from .env or environment)
# ==============================================================================
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
CUSTOM_FFMPEG_PATH = os.getenv("CUSTOM_FFMPEG_PATH", "")


# ==============================================================================
# 📁 DIRECTORY STRUCTURE & PATHS
# ==============================================================================
BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
TEMP_DIR = STORAGE_DIR / "temp"
MEDIA_DIR = STORAGE_DIR / "media"
OUTPUT_DIR = STORAGE_DIR / "output"
ASSETS_DIR = BASE_DIR / "assets"
SOUNDBEDS_DIR = ASSETS_DIR / "soundbeds"
FONTS_DIR = ASSETS_DIR / "fonts"

MUSIC_DIR = STORAGE_DIR / "music"

# Create required directories automatically
for d in [STORAGE_DIR, TEMP_DIR, MEDIA_DIR, OUTPUT_DIR, ASSETS_DIR, SOUNDBEDS_DIR, FONTS_DIR, MUSIC_DIR]:
    d.mkdir(parents=True, exist_ok=True)


# ==============================================================================
# 🎬 FFMPEG EXECUTABLE RESOLUTION
# ==============================================================================
def get_ffmpeg_path() -> str:
    """Finds FFmpeg executable via custom path, system PATH, or imageio-ffmpeg."""
    if CUSTOM_FFMPEG_PATH and os.path.exists(CUSTOM_FFMPEG_PATH):
        return CUSTOM_FFMPEG_PATH

    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"

FFMPEG_EXE = get_ffmpeg_path()


# ==============================================================================
# 🎨 BROADCAST GRAPHIC THEMES
# ==============================================================================
THEMES = {
    "breaking_news": {
        "name": "Global Breaking News",
        "primary_color": "#D32F2F",    # Urgent Red
        "secondary_color": "#1E293B",  # Deep Slate
        "accent_color": "#FFC107",     # Gold Yellow
        "text_color": "#FFFFFF",
        "badge_text": "BREAKING NEWS"
    },
    "tech_pulse": {
        "name": "Tech & AI Pulse",
        "primary_color": "#0284C7",    # Cyan Blue
        "secondary_color": "#0F172A",  # Dark Navy
        "accent_color": "#38BDF8",     # Electric Sky
        "text_color": "#FFFFFF",
        "badge_text": "TECH EXCLUSIVE"
    },
    "financial_wire": {
        "name": "Financial & Markets",
        "primary_color": "#059669",    # Emerald Green
        "secondary_color": "#111827",  # Pitch Black
        "accent_color": "#10B981",     # Mint Accent
        "text_color": "#FFFFFF",
        "badge_text": "MARKET WATCH"
    },
    "sports_center": {
        "name": "Sports Central",
        "primary_color": "#EA580C",    # Vivid Orange
        "secondary_color": "#18181B",  # Carbon Zinc
        "accent_color": "#FACC15",     # Stadium Yellow
        "text_color": "#FFFFFF",
        "badge_text": "SPORTS DESK"
    },
    "documentary": {
        "name": "Historical / Doc",
        "primary_color": "#854D0E",    # Warm Ochre
        "secondary_color": "#1C1917",  # Deep Sepia
        "accent_color": "#D97706",     # Amber
        "text_color": "#FFFFFF",
        "badge_text": "SPECIAL REPORT"
    }
}


# ==============================================================================
# 🎙️ TTS VOICE PRESETS (Edge-TTS)
# ==============================================================================
DEFAULT_VOICES = {
    "en_male": "en-US-GuyNeural",
    "en_female": "en-US-AriaNeural",
    "en_news": "en-US-ChristopherNeural",
    "hi_male": "hi-IN-MadhurNeural",
    "hi_female": "hi-IN-SwaraNeural",
    "gu_male": "gu-IN-NiranjanNeural",
    "gu_female": "gu-IN-DhwaniNeural"
}


# ==============================================================================
# 🎥 MOTION & VISUAL PACING CONFIGURATION (Ken Burns & Scene Interval)
# ==============================================================================
# Maximum time interval (in seconds) a single image remains on screen before
# cutting to the next visual shot with Ken Burns motion (prevents static pause).
MAX_SCENE_INTERVAL = 3.0  # seconds per visual cut

MOTION_CONFIG = {
    "max_shot_duration": MAX_SCENE_INTERVAL,  # Max seconds per image cut (default 3.0s)
    "min_shot_duration": 1.5,                 # Minimum seconds per cut
    "default_transition": "crossfade",        # Default transition between visual cuts (OpenReel native)
    "transition_duration": 0.5,               # Default transition duration in seconds
    "motion_styles": ["zoom_in", "pan_right", "zoom_out", "pan_left"],
}

