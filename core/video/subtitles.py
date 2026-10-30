import os
from pathlib import Path
from typing import List, Dict, Any
from config import TEMP_DIR

class SubtitleStyler:
    """Generates professional broadcast-style ASS and SRT subtitle files."""

    def __init__(self, temp_dir: Path = TEMP_DIR):
        self.temp_dir = temp_dir

    def create_ass_subtitles(self, scenes_data: List[Dict[str, Any]], output_path: str, aspect_ratio: str = "16:9") -> str:
        """Generates an Advanced SubStation Alpha (.ass) subtitle file formatted for video."""
        is_vertical = (aspect_ratio == "9:16")
        
        play_res_x = 1080 if is_vertical else 1920
        play_res_y = 1920 if is_vertical else 1080
        font_size = 54 if is_vertical else 40
        margin_v = 180 if is_vertical else 75

        ass_header = f"""[Script Info]
Title: AI News Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: {play_res_x}
PlayResY: {play_res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: NewsSub,Nirmala UI,{font_size},&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,{margin_v},1
Style: HighlightSub,Nirmala UI,{font_size},&H0000F5FF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,40,40,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

        events = []
        current_time = 0.0

        for scene in scenes_data:
            start_t = scene.get("timeline_start", current_time)
            duration = scene.get("allotted_duration", scene.get("audio_duration", 4.0))
            text = scene.get("narration_text", "").strip()
            word_times = scene.get("word_timestamps", [])

            if word_times and len(word_times) > 0:
                chunk_size = 5
                for i in range(0, len(word_times), chunk_size):
                    chunk = word_times[i:i + chunk_size]
                    chunk_start = start_t + chunk[0]["start"]
                    chunk_end = min(start_t + chunk[-1]["end"], start_t + duration)
                    chunk_text = " ".join([w["word"] for w in chunk])
                    
                    start_str = self._format_ass_timestamp(chunk_start)
                    end_str = self._format_ass_timestamp(chunk_end)
                    events.append(f"Dialogue: 0,{start_str},{end_str},NewsSub,,0,0,0,,{chunk_text}")
            else:
                start_str = self._format_ass_timestamp(start_t)
                end_str = self._format_ass_timestamp(start_t + duration)
                formatted_text = self._wrap_text(text, max_len=45 if not is_vertical else 26)
                events.append(f"Dialogue: 0,{start_str},{end_str},NewsSub,,0,0,0,,{formatted_text}")

            current_time = start_t + duration

        full_content = ass_header + "\n".join(events) + "\n"
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(full_content)

        return output_path

    def _wrap_text(self, text: str, max_len: int = 40) -> str:
        words = text.split()
        lines = []
        current_line = []
        for word in words:
            current_line.append(word)
            if len(" ".join(current_line)) > max_len:
                lines.append(" ".join(current_line))
                current_line = []
        if current_line:
            lines.append(" ".join(current_line))
        return "\\N".join(lines[:2])

    def _format_ass_timestamp(self, seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centisecs = int((seconds - int(seconds)) * 100)
        return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"

