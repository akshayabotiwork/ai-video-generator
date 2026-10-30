# Re-export from modular core.media package
from core.media.downloader import MediaDownloader
from core.media.fallback_card import MediaCardFallback

__all__ = ["MediaDownloader", "MediaCardFallback"]
