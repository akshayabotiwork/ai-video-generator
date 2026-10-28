import os
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from config import TEMP_DIR, THEMES, STORAGE_DIR

class GraphicsGenerator:
    """Generates transparent broadcast overlays: Lower Thirds, Tickers, and Badges."""

    def __init__(self, temp_dir: Path = TEMP_DIR):
        self.temp_dir = temp_dir
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def generate_lower_third_overlay(
        self,
        headline: str,
        category_tag: str,
        theme_key: str = "breaking_news",
        aspect_ratio: str = "16:9",
        scene_id: int = 1
    ) -> str:
        """Creates a high-resolution transparent PNG overlay containing the Lower-Third broadcast bar."""
        is_vertical = (aspect_ratio == "9:16")
        width = 1080 if is_vertical else 1920
        height = 1920 if is_vertical else 1080

        theme = THEMES.get(theme_key, THEMES["breaking_news"])
        primary_hex = theme["primary_color"]
        secondary_hex = theme["secondary_color"]
        accent_hex = theme["accent_color"]

        # Parse hex colors
        def hex_to_rgb(h):
            h = h.lstrip('#')
            return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

        primary_rgb = hex_to_rgb(primary_hex)
        secondary_rgb = hex_to_rgb(secondary_hex)
        accent_rgb = hex_to_rgb(accent_hex)

        # Load Multi-lingual Font (Nirmala UI supports Hindi, Gujarati, English)
        font_headline = None
        font_tag = None
        font_live = None
        font_paths = ["C:/Windows/Fonts/Nirmala.ttc", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"]
        for fp in font_paths:
            if os.path.exists(fp):
                try:
                    font_headline = ImageFont.truetype(fp, 36 if not is_vertical else 42)
                    font_tag = ImageFont.truetype(fp, 22 if not is_vertical else 26)
                    font_live = ImageFont.truetype(fp, 20 if not is_vertical else 22)
                    break
                except Exception:
                    pass

        # Create transparent canvas
        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Dimensions & Coordinates for Lower-Third
        margin_left = 60 if not is_vertical else 40
        bar_bottom = height - (140 if not is_vertical else 260)
        bar_height = 110 if not is_vertical else 140
        bar_width = width - (margin_left * 2)

        # Top Category Tag Bar
        tag_height = 42 if not is_vertical else 48
        tag_y = bar_bottom - bar_height - tag_height + 6
        tag_width = 380 if not is_vertical else 420
        
        # Draw Category Tag Badge with angled/modern edge
        draw.rectangle([margin_left, tag_y, margin_left + tag_width, tag_y + tag_height], fill=(*primary_rgb, 245))
        # Small accent indicator block
        draw.rectangle([margin_left, tag_y, margin_left + 14, tag_y + tag_height], fill=(*accent_rgb, 255))
        
        # Tag Text
        tag_display = f" {category_tag.upper() or theme['badge_text']} "
        draw.text((margin_left + 26, tag_y + 8), tag_display, fill=(255, 255, 255, 255), font=font_tag)

        # Main Lower-Third Headline Bar (Semi-transparent dark slate / glass background)
        main_bar_y = bar_bottom - bar_height
        draw.rectangle(
            [margin_left, main_bar_y, margin_left + bar_width, bar_bottom],
            fill=(*secondary_rgb, 230)
        )
        # Left Accent Border
        draw.rectangle(
            [margin_left, main_bar_y, margin_left + 14, bar_bottom],
            fill=(*primary_rgb, 255)
        )

        # Clean Headline Text
        clean_headline = (headline or "SPECIAL REPORT").upper()
        # Truncate if too long
        max_chars = 52 if not is_vertical else 30
        if len(clean_headline) > max_chars:
            clean_headline = clean_headline[:max_chars - 3] + "..."

        draw.text((margin_left + 40, main_bar_y + 30), clean_headline, fill=(255, 255, 255, 255), font=font_headline)

        # Channel Live Bug (Top-Right or Top-Left)
        bug_x = width - (240 if not is_vertical else 220)
        bug_y = 60 if not is_vertical else 100
        # Red LIVE pill
        draw.rectangle([bug_x, bug_y, bug_x + 160, bug_y + 44], fill=(220, 38, 38, 230))
        # White dot indicator
        draw.ellipse([bug_x + 18, bug_y + 15, bug_x + 32, bug_y + 29], fill=(255, 255, 255, 255))
        draw.text((bug_x + 44, bug_y + 10), "LIVE NEWS", fill=(255, 255, 255, 255), font=font_live)

        output_path = self.temp_dir / f"overlay_scene_{scene_id}.png"
        img.save(output_path, "PNG")
        return str(output_path)

    def generate_ticker_tape_overlay(
        self,
        ticker_items: list,
        theme_key: str = "breaking_news",
        aspect_ratio: str = "16:9"
    ) -> str:
        """Creates the bottom crawling ticker banner background."""
        is_vertical = (aspect_ratio == "9:16")
        width = 1080 if is_vertical else 1920
        height = 1920 if is_vertical else 1080

        theme = THEMES.get(theme_key, THEMES["breaking_news"])
        ticker_bg = (15, 23, 42, 240)  # Dark glass navy

        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        ticker_h = 60 if not is_vertical else 80
        ticker_y = height - ticker_h

        # Draw full width ticker bar
        draw.rectangle([0, ticker_y, width, height], fill=ticker_bg)
        
        # Left Tag "NEWS TICKER"
        tag_w = 200 if not is_vertical else 180
        draw.rectangle([0, ticker_y, tag_w, height], fill=(220, 38, 38, 255))
        draw.text((25, ticker_y + 18), "HEADLINES", fill=(255, 255, 255, 255))

        # Ticker static content text
        ticker_text = "  •  ".join(ticker_items) if ticker_items else "STAY TUNED FOR LIVE UPDATES  •  GLOBAL NEWS NETWORK"
        draw.text((tag_w + 30, ticker_y + 18), ticker_text, fill=(241, 245, 249, 255))

        output_path = self.temp_dir / "ticker_overlay.png"
        img.save(output_path, "PNG")
        return str(output_path)

    def prepare_canvas_image(self, input_image_path: str, output_image_path: str, aspect_ratio: str = "16:9") -> str:
        """Adapts an arbitrary image to exact 1920x1080 or 1080x1920 with blurred backdrop fill."""
        is_vertical = (aspect_ratio == "9:16")
        target_w = 1080 if is_vertical else 1920
        target_h = 1920 if is_vertical else 1080

        if input_image_path and not os.path.exists(input_image_path):
            norm = str(input_image_path).replace("\\", "/")
            if "/storage/" in norm:
                cand = STORAGE_DIR / norm.split("/storage/", 1)[1]
                if cand.exists():
                    input_image_path = str(cand)
            elif (STORAGE_DIR / norm.lstrip("/")).exists():
                input_image_path = str(STORAGE_DIR / norm.lstrip("/"))
            elif norm.startswith("http://") or norm.startswith("https://"):
                import hashlib, urllib.request
                try:
                    h = hashlib.md5(norm.encode("utf-8")).hexdigest()[:12]
                    cached = self.temp_dir / f"dl_{h}.jpg"
                    if not cached.exists() or cached.stat().st_size < 1000:
                        urllib.request.urlretrieve(norm, str(cached))
                    if cached.exists():
                        input_image_path = str(cached)
                except Exception:
                    pass

        if not input_image_path or not os.path.exists(input_image_path):
            bg = Image.new("RGB", (target_w, target_h), (15, 23, 42))
            bg.save(output_image_path, "JPEG", quality=95)
            return output_image_path

        # If input is a video file, extract a frame first
        if input_image_path.lower().endswith(('.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v')):
            from config import FFMPEG_EXE
            import subprocess
            frame_tmp = self.temp_dir / f"extracted_{Path(input_image_path).stem[:20]}.jpg"
            subprocess.run([
                FFMPEG_EXE, "-y", "-ss", "00:00:00.1", "-i", input_image_path,
                "-vframes", "1", "-q:v", "2", str(frame_tmp)
            ], capture_output=True)
            if frame_tmp.exists():
                input_image_path = str(frame_tmp)

        with Image.open(input_image_path) as orig:
            orig = orig.convert("RGB")
            orig_w, orig_h = orig.size

            # 1. Create blurred full-bleed background
            bg = orig.resize((target_w, target_h), Image.Resampling.BICUBIC)
            bg = bg.filter(ImageFilter.GaussianBlur(radius=25))

            # 2. Scale foreground image maintaining aspect ratio
            scale = min(target_w / orig_w, target_h / orig_h)
            new_w = int(orig_w * scale)
            new_h = int(orig_h * scale)
            fg = orig.resize((new_w, new_h), Image.Resampling.LANCZOS)

            # 3. Paste centered
            pos_x = (target_w - new_w) // 2
            pos_y = (target_h - new_h) // 2
            bg.paste(fg, (pos_x, pos_y))

            bg.save(output_image_path, "JPEG", quality=95)

        return output_image_path
