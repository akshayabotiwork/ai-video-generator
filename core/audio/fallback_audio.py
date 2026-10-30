import subprocess
from pathlib import Path
from typing import Tuple, List, Dict, Any
from config import FFMPEG_EXE

class AudioFallbackManager:
    """
    Audio Subsystem Fallbacks:
    1. Silent Audio Generator: Synthesizes timed silent audio when Edge-TTS is offline/unavailable.
    2. Synthetic Drone Soundbed: Synthesizes low-frequency ambient drone when background music is absent.
    """

    @staticmethod
    def generate_silent_audio(
        temp_dir: Path,
        scene_id: int,
        text_length: int
    ) -> Tuple[str, float, List[Dict[str, Any]]]:
        """Creates a silent audio file using FFmpeg anullsrc as a reliable fallback."""
        est_duration = max(3.5, text_length / 15.0)
        audio_file = temp_dir / f"scene_{scene_id}_audio_silent.mp3"

        cmd = [
            FFMPEG_EXE, "-y", "-f", "lavfi",
            "-i", "anullsrc=r=44100:cl=stereo",
            "-t", str(est_duration),
            "-q:a", "9", "-acodec", "libmp3lame",
            str(audio_file)
        ]
        try:
            subprocess.run(cmd, capture_output=True, check=True)
        except Exception as e:
            print(f"[AudioFallbackManager] Silent audio fallback generation error: {e}")

        return str(audio_file), round(est_duration, 3), []

    @staticmethod
    def synthesize_ambient_drone_bed(output_file: Path, duration_sec: int = 180) -> bool:
        """Synthesizes a pleasant low-frequency rhythmic broadcast drone bed at 110Hz."""
        cmd = [
            FFMPEG_EXE, "-y",
            "-f", "lavfi", "-i", f"sine=frequency=110:duration={duration_sec}",
            "-filter_complex", "[0:a]volume=0.03,lowpass=f=300[aout]",
            "-map", "[aout]",
            "-c:a", "libmp3lame",
            "-b:a", "192k",
            str(output_file)
        ]
        try:
            subprocess.run(cmd, capture_output=True, check=True)
            return True
        except Exception:
            return False

