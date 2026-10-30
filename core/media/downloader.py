import os
import hashlib
import requests
from pathlib import Path
from typing import Optional, Any
from PIL import Image
from config import MEDIA_DIR, TEMP_DIR
from core.logger import system_logger
from core.media.fallback_card import MediaCardFallback

class MediaDownloader:
    """Safely downloads, validates, and normalizes visual assets for video compositing."""

    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = output_dir or MEDIA_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "image/webp,image/apng,image/png,image/jpeg,image/*,*/*;q=0.8",
            "Referer": "https://www.google.com/",
            "Sec-Fetch-Dest": "image",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site",
        })

    def _download_url_to_file(self, url: str, target_path: Path, scene_id: Any) -> bool:
        if not url:
            return False

        if url.startswith("data:image/"):
            try:
                import base64
                _, encoded = url.split(",", 1)
                data = base64.b64decode(encoded)
                with open(target_path, "wb") as f:
                    f.write(data)
                return True
            except Exception as e:
                system_logger.warning("DOWNLOADER", f"Scene {scene_id}: Base64 decode failed: {e}")
                return False

        try:
            resp = self.session.get(url, timeout=12, stream=True)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "").lower()
                if "text/html" in content_type or "text/plain" in content_type:
                    system_logger.warning("DOWNLOADER", f"Scene {scene_id}: Server returned non-image content-type '{content_type}' for {url[:60]}")
                    return False

                with open(target_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=32768):
                        if chunk:
                            f.write(chunk)
                return True
            else:
                system_logger.warning("DOWNLOADER", f"Scene {scene_id}: Download HTTP {resp.status_code} for {url[:60]}")
                return False
        except Exception as e:
            system_logger.warning("DOWNLOADER", f"Scene {scene_id}: Download error for {url[:60]}: {e}")
            return False

    def download_and_validate(
        self,
        url: str,
        scene_id: Any,
        fallback_headline: str = "",
        category_tag: str = "NEWS",
        generate_fallback: bool = True,
        fallback_url: str = ""
    ) -> str:
        """Downloads image from primary or fallback URL, validates file integrity, and returns local path."""
        if not url and not fallback_url:
            return self._generate_fallback_card(scene_id, fallback_headline, category_tag) if generate_fallback else ""

        primary_url = url or fallback_url
        secondary_url = fallback_url if (url and fallback_url and url != fallback_url) else ""

        url_hash = hashlib.md5(primary_url.encode("utf-8")).hexdigest()[:10]
        local_filename = f"scene_{scene_id}_{url_hash}.jpg"
        target_path = self.output_dir / local_filename

        if target_path.exists() and target_path.stat().st_size > 5000:
            if self._validate_image(target_path, scene_id):
                return str(target_path)

        # 1. Primary URL Download
        system_logger.info("DOWNLOADER", f"Scene {scene_id}: Fetching visual asset from {primary_url[:60]}...")
        if self._download_url_to_file(primary_url, target_path, scene_id) and self._validate_image(target_path, scene_id):
            system_logger.success("DOWNLOADER", f"Scene {scene_id}: High-res photo verified and cached ({local_filename})")
            return str(target_path)

        # 2. Fallback URL Download (e.g. Google CDN thumbnail_url)
        if secondary_url:
            system_logger.info("DOWNLOADER", f"Scene {scene_id}: Primary failed, trying fallback CDN thumbnail from {secondary_url[:60]}...")
            sec_hash = hashlib.md5(secondary_url.encode("utf-8")).hexdigest()[:10]
            sec_filename = f"scene_{scene_id}_{sec_hash}.jpg"
            sec_target = self.output_dir / sec_filename
            if self._download_url_to_file(secondary_url, sec_target, scene_id) and self._validate_image(sec_target, scene_id):
                system_logger.success("DOWNLOADER", f"Scene {scene_id}: Verified and cached via fallback thumbnail ({sec_filename})")
                return str(sec_target)

        # 3. Graphical Fallback Card
        if generate_fallback:
            system_logger.warning("DOWNLOADER", f"Scene {scene_id}: All image downloads failed. Generating broadcast fallback card.")
            return self._generate_fallback_card(scene_id, fallback_headline, category_tag)
        return ""

    def _validate_image(self, file_path: Path, scene_id: Any = 0) -> bool:
        """Verifies image integrity using PIL and standardizes color mode to RGB."""
        try:
            rgb_img = None
            with Image.open(file_path) as img:
                img.load()
                if getattr(img, "is_animated", False):
                    img.seek(0)
                
                need_conversion = (img.mode != "RGB") or (img.format != "JPEG")
                if need_conversion:
                    if img.mode in ("RGBA", "LA", "P"):
                        bg = Image.new("RGB", img.size, (255, 255, 255))
                        rgba_img = img.convert("RGBA")
                        bg.paste(rgba_img, mask=rgba_img.split()[3])
                        rgb_img = bg
                    else:
                        rgb_img = img.convert("RGB")

            if rgb_img is not None:
                temp_target = file_path.with_suffix(".tmp.jpg")
                rgb_img.save(temp_target, "JPEG", quality=92)
                if temp_target.exists():
                    temp_target.replace(file_path)
            return True
        except Exception as e:
            system_logger.warning("DOWNLOADER", f"Scene {scene_id}: Image validation error for {file_path.name}: {e}. Removing corrupt cache.")
            if file_path.exists():
                try:
                    file_path.unlink(missing_ok=True)
                except Exception:
                    pass
            return False

    def _generate_fallback_card(self, scene_id: int, headline: str, category_tag: str) -> str:
        """Delegates to MediaCardFallback for broadcast card generation."""
        return MediaCardFallback.generate_broadcast_card(self.output_dir, scene_id, headline, category_tag)

