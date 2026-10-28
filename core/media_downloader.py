import os
import hashlib
import requests
from pathlib import Path
from typing import Optional, Any
from PIL import Image, ImageDraw, ImageFont
from config import MEDIA_DIR, TEMP_DIR
from core.logger import system_logger

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
        """Downloads url or decodes base64 data to target_path."""
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

        # Generate unique filename hash
        url_hash = hashlib.md5(primary_url.encode("utf-8")).hexdigest()[:10]
        local_filename = f"scene_{scene_id}_{url_hash}.jpg"
        target_path = self.output_dir / local_filename

        # If already downloaded and valid, return it
        if target_path.exists() and target_path.stat().st_size > 5000:
            if self._validate_image(target_path, scene_id):
                return str(target_path)

        # 1. Attempt download of primary URL
        system_logger.info("DOWNLOADER", f"Scene {scene_id}: Fetching visual asset from {primary_url[:60]}...")
        if self._download_url_to_file(primary_url, target_path, scene_id) and self._validate_image(target_path, scene_id):
            system_logger.success("DOWNLOADER", f"Scene {scene_id}: High-res photo verified and cached ({local_filename})")
            return str(target_path)

        # 2. Attempt download of fallback URL (e.g. Google CDN thumbnail_url)
        if secondary_url:
            system_logger.info("DOWNLOADER", f"Scene {scene_id}: Primary failed, trying fallback CDN thumbnail from {secondary_url[:60]}...")
            sec_hash = hashlib.md5(secondary_url.encode("utf-8")).hexdigest()[:10]
            sec_filename = f"scene_{scene_id}_{sec_hash}.jpg"
            sec_target = self.output_dir / sec_filename
            if self._download_url_to_file(secondary_url, sec_target, scene_id) and self._validate_image(sec_target, scene_id):
                system_logger.success("DOWNLOADER", f"Scene {scene_id}: Verified and cached via fallback thumbnail ({sec_filename})")
                return str(sec_target)

        # 3. If download or validation failed, generate fallback card only if requested
        if generate_fallback:
            system_logger.warning("DOWNLOADER", f"Scene {scene_id}: All image downloads failed. Generating broadcast fallback card.")
            return self._generate_fallback_card(scene_id, fallback_headline, category_tag)
        return ""

    def _validate_image(self, file_path: Path, scene_id: Any = 0) -> bool:
        """Verifies image integrity using PIL and standardizes color mode to RGB without Windows file locks."""
        try:
            rgb_img = None
            # Fully load and release file handle immediately
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

            # Safe to overwrite outside 'with' context on Windows
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
        """Generates a high-resolution broadcast title card image when external media is unavailable."""
        target_path = self.output_dir / f"scene_{scene_id}_card.jpg"
        width, height = 1920, 1080

        # Create gradient dark studio background
        base = Image.new("RGB", (width, height), (15, 23, 42))
        draw = ImageDraw.Draw(base)

        # Draw subtle grid/geometric broadcast accents
        for y in range(0, height, 40):
            draw.line([(0, y), (width, y)], fill=(25, 35, 60), width=1)
        for x in range(0, width, 40):
            draw.line([(x, 0), (x, height)], fill=(25, 35, 60), width=1)

        # Category Badge banner
        badge_text = category_tag.upper() or "NEWS SPECIAL"
        draw.rectangle([(160, 360), (520, 430)], fill=(220, 38, 38))
        draw.text((180, 380), badge_text, fill=(255, 255, 255))

        # Main Headline
        clean_headline = headline or f"SCENE {scene_id} REPORT"
        # Split into lines if long
        words = clean_headline.split()
        lines = []
        cur_line = []
        for w in words:
            cur_line.append(w)
            if len(" ".join(cur_line)) > 28:
                lines.append(" ".join(cur_line))
                cur_line = []
        if cur_line:
            lines.append(" ".join(cur_line))

        y_offset = 480
        for line in lines[:3]:
            draw.text((160, y_offset), line, fill=(255, 255, 255))
            y_offset += 90

        base.save(target_path, "JPEG", quality=95)
        system_logger.info("DOWNLOADER", f"Scene {scene_id}: Generated fallback broadcast graphic card '{clean_headline[:30]}'")
        return str(target_path)

