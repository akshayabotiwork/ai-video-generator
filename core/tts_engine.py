import os
import re
import asyncio
import edge_tts
from pathlib import Path
from typing import Dict, Any, List, Tuple
from config import TEMP_DIR, DEFAULT_VOICES, FFMPEG_EXE
from core.logger import system_logger

def _normalize_token(token: str) -> str:
    """Strips punctuation and whitespace for robust phonetic/word sequence matching."""
    return re.sub(r'[\s\.,।?!:;"\'\-–—()]+', '', token).strip().lower()

class TTSEngine:
    """
    Synthesizes broadcast voiceover narration and generates frame-accurate
    synchronized word timestamps and scene cut intervals.
    """

    def __init__(self, default_voice: str = "en-US-GuyNeural"):
        self.default_voice = default_voice
        self.temp_dir = TEMP_DIR
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    async def generate_speech_async(
        self,
        text: str,
        scene_id: int,
        voice: str = ""
    ) -> Tuple[str, float, List[Dict[str, Any]]]:
        """
        Synthesizes speech for scene text asynchronously with word-level boundary accuracy.
        Returns: (audio_path, duration_seconds, word_timestamps)
        """
        selected_voice = voice or self.default_voice
        clean_text = text.strip()
        if not clean_text:
            clean_text = "News update."

        audio_file = self.temp_dir / f"scene_{scene_id}_audio.mp3"
        vtt_file = self.temp_dir / f"scene_{scene_id}_subtitles.vtt"

        word_timestamps: List[Dict[str, Any]] = []
        
        try:
            system_logger.info("TTS", f"Scene {scene_id}: Synthesizing neural speech ({len(clean_text.split())} words, voice: {selected_voice})...")
            communicate = edge_tts.Communicate(clean_text, selected_voice, boundary="WordBoundary")
            submaker = edge_tts.SubMaker()
            
            with open(audio_file, "wb") as f:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        offset_sec = chunk["offset"] / 10_000_000.0
                        dur_sec = chunk["duration"] / 10_000_000.0
                        word_timestamps.append({
                            "word": chunk["text"],
                            "start": round(offset_sec, 3),
                            "end": round(offset_sec + dur_sec, 3)
                        })
                        submaker.feed(chunk)

            with open(vtt_file, "w", encoding="utf-8") as f:
                f.write(submaker.get_srt())

            duration = await self._get_audio_duration(str(audio_file))
            if duration <= 0.0 and word_timestamps:
                duration = round(word_timestamps[-1]["end"] + 0.25, 3)

            system_logger.success("TTS", f"Scene {scene_id}: Audio ready ({duration:.2f}s, {len(word_timestamps)} word boundaries)")
            return str(audio_file), duration, word_timestamps

        except Exception as e:
            system_logger.warning("TTS", f"Scene {scene_id}: EdgeTTS error: {e}. Generating fallback silence.")
            return await self._generate_fallback_silent_audio(scene_id, len(clean_text))

    def _align_scenes_to_words(
        self,
        scenes_texts: List[str],
        all_words: List[Dict[str, Any]],
        total_duration: float
    ) -> Tuple[List[Tuple[float, float]], List[List[Dict[str, Any]]]]:
        """
        Calculates millisecond-accurate timeline cuts and scene-specific word timestamps
        by matching scene sentences to the Edge-TTS word boundary stream.
        Visual cuts are placed at the exact pause between the last word of scene i
        and the first word of scene i+1.
        """
        N = len(scenes_texts)
        if N <= 0:
            return [(0.0, total_duration)], []

        if not all_words or N == 1:
            return [(0.0, total_duration)], [all_words]

        scene_word_indices: List[Tuple[int, int]] = []
        w_idx = 0
        total_words = len(all_words)

        for s_idx, scene_text in enumerate(scenes_texts):
            s_tokens = [_normalize_token(w) for w in scene_text.split() if _normalize_token(w)]
            if not s_tokens:
                scene_word_indices.append((w_idx, w_idx))
                continue

            matched_first = None
            matched_last = None

            for target_token in s_tokens:
                # Lookahead window of up to 30 words to absorb slight pronunciation or boundary variations
                found = False
                for look in range(w_idx, min(w_idx + 30, total_words)):
                    stream_token = _normalize_token(all_words[look]["word"])
                    if stream_token == target_token or target_token in stream_token or stream_token in target_token:
                        w_idx = look
                        found = True
                        break

                if matched_first is None and found:
                    matched_first = w_idx
                if found:
                    matched_last = w_idx
                    w_idx += 1

            if matched_first is None:
                fallback_idx = min(w_idx, total_words - 1)
                matched_first = fallback_idx
                matched_last = min(w_idx + max(1, len(s_tokens)) - 1, total_words - 1)
                w_idx = min(matched_last + 1, total_words)

            scene_word_indices.append((matched_first, matched_last))

        # Calculate exact cut points at speech pauses between consecutive scenes
        cuts = [0.0]
        for i in range(N - 1):
            _, last_w_i = scene_word_indices[i]
            next_first_w, _ = scene_word_indices[i + 1]

            end_i = all_words[last_w_i]["end"]
            start_next = all_words[next_first_w]["start"]

            # Midpoint cut in natural pause between thoughts
            if start_next >= end_i:
                cut = (end_i + start_next) / 2.0
            else:
                cut = end_i

            # Ensure monotonic progress and minimum scene breathing room
            min_allowed = cuts[-1] + 1.2
            if cut < min_allowed:
                cut = min_allowed

            # Guarantee headroom for subsequent scenes
            remaining_scenes = (N - 1) - i
            max_allowed = total_duration - (remaining_scenes * 1.0)
            if cut > max_allowed and max_allowed > cuts[-1]:
                cut = max_allowed

            cuts.append(round(cut, 3))

        cuts.append(round(total_duration, 3))

        intervals: List[Tuple[float, float]] = []
        scene_word_map: List[List[Dict[str, Any]]] = []

        for i in range(N):
            t_start = cuts[i]
            t_end = cuts[i + 1]
            intervals.append((t_start, t_end))

            # Collect words within this scene's exact timeline interval
            s_words = []
            for w in all_words:
                if w["end"] <= t_start:
                    continue
                if w["start"] >= t_end:
                    break
                s_words.append({
                    "word": w["word"],
                    "start": max(0.0, round(w["start"] - t_start, 3)),
                    "end": max(0.05, round(w["end"] - t_start, 3)),
                    "abs_start": w["start"],
                    "abs_end": w["end"]
                })
            scene_word_map.append(s_words)

        return intervals, scene_word_map

    async def generate_full_narration_async(
        self,
        full_text: str,
        scenes_texts: List[str],
        voice: str = ""
    ) -> Tuple[str, float, List[Tuple[float, float]], List[List[Dict[str, Any]]]]:
        """
        Synthesizes the ENTIRE script in ONE continuous, broadcast-quality master audio track
        and extracts word-boundary timestamps for 100% frame-perfect scene sync.
        Returns:
            master_audio_path: str
            total_duration: float
            scene_intervals: List of (start_sec, end_sec) for each scene
            scene_words: List of word_timestamp dicts per scene
        """
        selected_voice = voice or self.default_voice
        clean_scenes = [s.strip() for s in scenes_texts if s.strip()]
        if full_text and full_text.strip():
            clean_text = " ".join(full_text.strip().split())
        elif clean_scenes:
            clean_text = " ".join(clean_scenes)
        else:
            clean_text = "News broadcast update."

        master_audio = self.temp_dir / "master_narration_continuous.mp3"
        all_words: List[Dict[str, Any]] = []

        try:
            system_logger.info("TTS", f"Synthesizing continuous master voiceover: {len(clean_scenes)} scenes ({len(clean_text.split())} words) with voice '{selected_voice}'...")
            communicate = edge_tts.Communicate(clean_text, selected_voice, boundary="WordBoundary")
            with open(master_audio, "wb") as f:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        st = chunk["offset"] / 10_000_000.0
                        dur = chunk["duration"] / 10_000_000.0
                        all_words.append({
                            "word": chunk["text"],
                            "start": round(st, 3),
                            "end": round(st + dur, 3)
                        })

            total_duration = await self._get_audio_duration(str(master_audio))
            if total_duration <= 0.0:
                total_duration = round((all_words[-1]["end"] + 0.3) if all_words else 5.0, 3)

            system_logger.success("TTS", f"Master voiceover rendered: {total_duration:.2f}s audio, {len(all_words)} word-level timestamps synchronized")

        except Exception as e:
            system_logger.error("TTS", f"Continuous speech synthesis failed: {e}. Generating fallback silence...")
            fallback_file, total_duration, _ = await self._generate_fallback_silent_audio(999, len(clean_text))
            master_audio = Path(fallback_file)

        # Align scenes to words with millisecond precision
        intervals, scene_words = self._align_scenes_to_words(scenes_texts, all_words, total_duration)
        system_logger.info("TTS", f"Timeline synchronization: {len(intervals)} scene timing cuts locked")
        return str(master_audio), total_duration, intervals, scene_words

    def generate_full_narration(
        self,
        full_text: str,
        scenes_texts: List[str],
        voice: str = ""
    ) -> Tuple[str, float, List[Tuple[float, float]], List[List[Dict[str, Any]]]]:
        """Synchronous wrapper for generate_full_narration_async."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, self.generate_full_narration_async(full_text, scenes_texts, voice)).result()
            else:
                return loop.run_until_complete(self.generate_full_narration_async(full_text, scenes_texts, voice))
        except Exception:
            return asyncio.run(self.generate_full_narration_async(full_text, scenes_texts, voice))

    def generate_speech(self, text: str, scene_id: int, voice: str = "") -> Tuple[str, float, List[Dict[str, Any]]]:
        """Synchronous wrapper for generate_speech_async."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(asyncio.run, self.generate_speech_async(text, scene_id, voice)).result()
            else:
                return loop.run_until_complete(self.generate_speech_async(text, scene_id, voice))
        except Exception:
            return asyncio.run(self.generate_speech_async(text, scene_id, voice))

    async def _get_audio_duration(self, audio_path: str) -> float:
        """Determines exact duration of audio file using FFmpeg output stream inspection."""
        import subprocess
        try:
            cmd = [FFMPEG_EXE, "-i", audio_path, "-f", "null", "-"]
            res = subprocess.run(cmd, capture_output=True, text=True)
            m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", res.stderr)
            if m:
                hours, minutes, seconds = map(float, m.groups())
                return round(hours * 3600.0 + minutes * 60.0 + seconds, 3)
        except Exception as e:
            print(f"[TTSEngine] FFmpeg audio duration probe failed: {e}")

        # Fallback estimation based on file size (128kbps MP3 ~ 16KB/s)
        try:
            file_size = os.path.getsize(audio_path)
            return round(max(3.0, file_size / 16000.0), 3)
        except Exception:
            return 4.0

    async def _generate_fallback_silent_audio(self, scene_id: int, text_length: int) -> Tuple[str, float, List[Dict[str, Any]]]:
        """Creates a silent audio file using FFmpeg as a reliable fallback."""
        import subprocess

        est_duration = max(3.5, text_length / 15.0)
        audio_file = self.temp_dir / f"scene_{scene_id}_audio.mp3"
        
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
            print(f"[TTSEngine] Failed to generate silent fallback audio: {e}")

        return str(audio_file), round(est_duration, 3), []
