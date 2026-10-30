from pathlib import Path
from PIL import Image, ImageDraw
from core.logger import system_logger

class MediaCardFallback:
    """
    Visual Asset Fallback: Studio Graphic Title Card Generator
    Triggered when:
    1. Direct visual searches (Google, DDG, SerpAPI, Wikimedia) return no valid candidates.
    2. Image downloads fail integrity validation or are corrupt.
    
    Generates a broadcast-styled graphic title card with headline and category badges.
    """

    @staticmethod
    def generate_broadcast_card(
        output_dir: Path,
        scene_id: int,
        headline: str,
        category_tag: str
    ) -> str:
        output_dir.mkdir(parents=True, exist_ok=True)
        target_path = output_dir / f"scene_{scene_id}_card.jpg"
        width, height = 1920, 1080

        # Gradient dark studio backdrop
        base = Image.new("RGB", (width, height), (15, 23, 42))
        draw = ImageDraw.Draw(base)

        # Geometric subtle broadcast grid
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

