import os
import subprocess
from pathlib import Path
from typing import List, Optional
from config import FFMPEG_EXE, SOUNDBEDS_DIR, TEMP_DIR, MUSIC_DIR, STORAGE_DIR, MEDIA_DIR
from core.logger import system_logger

def _resolve_audio_file(p: Optional[str]) -> Optional[str]:
    """Resolves web URL paths (/storage/...) and filenames to local filesystem paths."""
    if not p:
        return None
    p_str = str(p).strip().replace("\\", "/")
    if os.path.exists(p_str):
        return p_str
    if "/storage/" in p_str:
        cand = STORAGE_DIR / p_str.split("/storage/", 1)[1]
        if cand.exists():
            return str(cand)
    elif p_str.startswith("storage/"):
        cand = STORAGE_DIR / p_str[len("storage/"):]
        if cand.exists():
            return str(cand)
    # Check by filename inside MEDIA_DIR, STORAGE_DIR, and MUSIC_DIR
    fname = Path(p_str).name
    for base in [MEDIA_DIR, STORAGE_DIR, MUSIC_DIR]:
        cand = base / fname
        if cand.exists():
            return str(cand)
    return str(p) if os.path.exists(str(p)) else None

class AudioMixer:
    """Manages multi-scene voiceover concatenation, background music beds, and automated ducking."""

    def __init__(self, temp_dir: Path = TEMP_DIR):
        self.temp_dir = temp_dir
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def _ensure_default_soundbed(self):
        """Ensures a pleasant background news ambient soundbed is present in storage/music."""
        music_file = MUSIC_DIR / "news_bed.mp3"
        if not music_file.exists():
            try:
                cmd = [ 
                    FFMPEG_EXE, "-y",
                    "-f", "lavfi", "-i", "sine=frequency=110:duration=180",
                    "-filter_complex", "[0:a]volume=0.03,lowpass=f=300[aout]",
                    "-map", "[aout]",
                    "-c:a", "libmp3lame",
                    "-b:a", "192k",
                    str(music_file)
                ]
                subprocess.run(cmd, capture_output=True, check=True)
            except Exception:
                pass

    def concatenate_scene_audios(self, audio_paths: List[str], output_path: str) -> str:
        """Concatenates individual scene voiceover MP3s into a seamless master narration track."""
        if not audio_paths:
            raise ValueError("No audio paths provided for concatenation.")

        if len(audio_paths) == 1:
            cmd = [FFMPEG_EXE, "-y", "-i", audio_paths[0], "-c", "copy", output_path]
            subprocess.run(cmd, capture_output=True, check=True)
            return output_path

        concat_list_file = self.temp_dir / "audio_concat_list.txt"
        with open(concat_list_file, "w", encoding="utf-8") as f:
            for p in audio_paths:
                safe_p = Path(p).as_posix()
                f.write(f"file '{safe_p}'\n")

        cmd = [
            FFMPEG_EXE, "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_list_file),
            "-c:a", "libmp3lame",
            "-b:a", "192k",
            output_path
        ]
        subprocess.run(cmd, capture_output=True, check=True)
        return output_path

    def assemble_synchronized_narration_track(
        self,
        scene_items: List[dict],
        output_path: str
    ) -> str:
        """
        Builds a precision-synchronized master narration track where each scene's audio
        is padded or trimmed to match its exact allotted timeline duration.
        Guarantees zero audio drift, lockstep alignment with visual cuts and transitions.
        """
        if not scene_items:
            raise ValueError("No scene audio items provided for timeline synchronization.")

        cmd = [FFMPEG_EXE, "-y"]
        filter_parts = []
        input_indices = []

        # Resolve all audio paths
        resolved_audios = [_resolve_audio_file(it.get("local_audio_path")) for it in scene_items]
        valid_audios = [a for a in resolved_audios if a and os.path.exists(a)]

        # Fast path: If all scene items share a single continuous audio file covering the timeline with default 1.0 volume
        all_default_vol = all(float(it.get("audio_volume", 1.0)) == 1.0 for it in scene_items)
        if all_default_vol and valid_audios and len(set(valid_audios)) == 1 and all(a == valid_audios[0] for a in resolved_audios):
            first_audio = valid_audios[0]
            total_req_dur = sum(float(it.get("allotted_duration", it.get("audio_duration", 3.0))) for it in scene_items)
            cmd_fast = [
                FFMPEG_EXE, "-y",
                "-i", Path(first_audio).as_posix(),
                "-t", str(round(total_req_dur, 3)),
                "-c:a", "libmp3lame",
                "-b:a", "192k",
                str(output_path)
            ]
            try:
                subprocess.run(cmd_fast, capture_output=True, check=True, timeout=60)
                return str(output_path)
            except Exception:
                pass  # Fall back to multi-segment pipeline

        # If a single master custom audio file was supplied across the timeline, use it as fallback
        single_master = valid_audios[0] if (len(valid_audios) > 0 and len(set(valid_audios)) == 1) else None

        for idx, item in enumerate(scene_items):
            audio_p = resolved_audios[idx] or single_master
            dur = max(float(item.get("allotted_duration", item.get("audio_duration", 3.0))), 0.1)
            vol = max(0.0, float(item.get("audio_volume", 1.0)))

            if audio_p == single_master and not resolved_audios[idx]:
                audio_offset = max(0.0, float(item.get("timeline_start", 0.0)))
            else:
                audio_offset = max(0.0, float(item.get("audio_offset", 0.0)))
            a_end = round(audio_offset + dur, 3)

            if audio_p and os.path.exists(audio_p):
                safe_p = Path(audio_p).as_posix()
                cmd.extend(["-i", safe_p])
                filter_parts.append(
                    f"[{idx}:a]atrim=start={audio_offset}:end={a_end},asetpts=PTS-STARTPTS,volume={vol:.2f},apad,atrim=0:{dur},asetpts=PTS-STARTPTS[a{idx}]"
                )
            else:
                cmd.extend(["-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={dur}"])
                filter_parts.append(f"[{idx}:a]atrim=0:{dur},asetpts=PTS-STARTPTS[a{idx}]")

            input_indices.append(f"[a{idx}]")

        total_inputs = len(scene_items)
        if total_inputs == 1:
            filter_parts.append("[a0]asetpts=PTS-STARTPTS[aout]")
        else:
            filter_parts.append(f"{''.join(input_indices)}concat=n={total_inputs}:v=0:a=1[aout]")
        filter_complex = ";".join(filter_parts)

        cmd.extend([
            "-filter_complex", filter_complex,
            "-map", "[aout]",
            "-c:a", "libmp3lame",
            "-b:a", "192k",
            str(output_path)
        ])

        subprocess.run(cmd, capture_output=True, check=True, timeout=90)
        return str(output_path)

    def mix_narration_with_soundbed(
        self,
        narration_audio_path: str,
        total_duration: float,
        output_path: str,
        soundbed_path: str = "",
        ducking_level: float = 1.0
    ) -> str:
        """Mixes master voiceover with an ambient news soundbed track using volume ducking."""
        resolved_soundbed = _resolve_audio_file(soundbed_path)

        # If music is muted or zero volume, or no soundbed found, output unmixed narration track
        if ducking_level <= 0.001 or not resolved_soundbed or not os.path.exists(resolved_soundbed):
            cmd = [
                FFMPEG_EXE, "-y",
                "-i", narration_audio_path,
                "-t", str(total_duration),
                "-c:a", "aac",
                "-b:a", "192k",
                output_path
            ]
            subprocess.run(cmd, capture_output=True, check=True)
            return output_path

        # Mix with external soundbed file using configured volume
        system_logger.info("MIXER", f"Mixing narration with background music (soundbed={resolved_soundbed}, volume={ducking_level:.2f})")
        cmd = [
            FFMPEG_EXE, "-y",
            "-i", narration_audio_path,
            "-stream_loop", "-1", "-i", resolved_soundbed,
            "-filter_complex",
            f"[1:a]volume={ducking_level:.2f},apad[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.98[aout]",
            "-map", "[aout]",
            "-t", str(total_duration),
            "-c:a", "aac",
            "-b:a", "192k",
            output_path
        ]
        try:
            subprocess.run(cmd, capture_output=True, check=True)
        except Exception:
            cmd_fallback = [
                FFMPEG_EXE, "-y",
                "-i", narration_audio_path,
                "-stream_loop", "-1", "-i", resolved_soundbed,
                "-filter_complex",
                f"[1:a]volume={ducking_level:.2f},apad[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]",
                "-map", "[aout]",
                "-t", str(total_duration),
                "-c:a", "aac",
                "-b:a", "192k",
                output_path
            ]
            subprocess.run(cmd_fallback, capture_output=True, check=True)
        return output_path

    def _mix_with_ambient_bed(self, narration_audio_path: str, total_duration: float, output_path: str, ducking_level: float) -> str:
        """Generates a pleasant low-frequency rhythmic broadcast drone bed using lavfi synthesizer."""
        # Subtle harmonic drone at 110Hz / 220Hz
        cmd = [
            FFMPEG_EXE, "-y",
            "-i", narration_audio_path,
            "-f", "lavfi", "-i", f"sine=frequency=110:duration={total_duration}",
            "-filter_complex",
            f"[1:a]volume=0.03,lowpass=f=300[bg];[0:a][bg]amix=inputs=2:duration=first[aout]",
            "-map", "[aout]",
            "-t", str(total_duration),
            "-c:a", "aac",
            "-b:a", "192k",
            output_path
        ]
        try:
            subprocess.run(cmd, capture_output=True, check=True)
        except Exception:
            # Fallback: copy narration directly
            cmd_copy = [FFMPEG_EXE, "-y", "-i", narration_audio_path, "-c:a", "aac", output_path]
            subprocess.run(cmd_copy, capture_output=True, check=True)

        return output_path
