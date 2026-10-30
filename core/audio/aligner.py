import os
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from core.logger import system_logger
from core.audio.tts import TTSEngine

_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            system_logger.info("ALIGN", "Loading local Faster-Whisper neural model (tiny on CPU)...")
            try:
                _whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
                system_logger.success("ALIGN", "Local Faster-Whisper neural model ready (CPU int8)")
            except Exception as e:
                system_logger.warning("ALIGN", f"CPU int8 mode fallback: {e}")
                _whisper_model = WhisperModel("tiny", device="cpu", compute_type="default")
                system_logger.success("ALIGN", "Local Faster-Whisper neural model ready (CPU default)")
        except Exception as e:
            system_logger.error("ALIGN", f"Failed to load Faster-Whisper: {e}")
            raise e
    return _whisper_model

def align_custom_audio(
    audio_path: str,
    scenes_texts: List[str]
) -> Tuple[float, List[Tuple[float, float]], List[List[Dict[str, Any]]]]:
    p = Path(audio_path)
    if not p.is_file():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    model = get_whisper_model()
    system_logger.info("ALIGN", f"Transcribing audio with word boundaries: {p.name}...")

    segments, info = model.transcribe(str(p), word_timestamps=True)

    all_words: List[Dict[str, Any]] = []
    for segment in segments:
        if hasattr(segment, "words") and segment.words:
            for word in segment.words:
                clean_w = word.word.strip()
                if clean_w:
                    all_words.append({
                        "word": clean_w,
                        "start": round(word.start, 3),
                        "end": round(word.end, 3)
                    })

    total_duration = round(getattr(info, "duration", 0.0), 3)
    if total_duration <= 0.0 and all_words:
        total_duration = round(all_words[-1]["end"] + 0.3, 3)

    system_logger.success(
        "ALIGN",
        f"Transcribed {len(all_words)} words over {total_duration:.2f}s (Detected language: {getattr(info, 'language', 'unknown')})"
    )

    non_empty = [t for t in scenes_texts if t.strip()]
    if not non_empty:
        total_duration, intervals, scene_words, _ = auto_segment_audio(audio_path, target_segments=len(scenes_texts) if scenes_texts else None)
        return total_duration, intervals, scene_words

    tts = TTSEngine()
    intervals, scene_words = tts._align_scenes_to_words(scenes_texts, all_words, total_duration)

    return total_duration, intervals, scene_words

def auto_segment_audio(
    audio_path: str,
    target_segments: Optional[int] = None
) -> Tuple[float, List[Tuple[float, float]], List[List[Dict[str, Any]]], List[str]]:
    p = Path(audio_path)
    if not p.is_file():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    model = get_whisper_model()
    system_logger.info("ALIGN", f"Auto-segmenting audio: {p.name}...")
    segments, info = model.transcribe(str(p), word_timestamps=True)

    all_words: List[Dict[str, Any]] = []
    whisper_segments: List[Dict[str, Any]] = []

    for segment in segments:
        seg_words = []
        if hasattr(segment, "words") and segment.words:
            for word in segment.words:
                clean_w = word.word.strip()
                if clean_w:
                    w_dict = {
                        "word": clean_w,
                        "start": round(word.start, 3),
                        "end": round(word.end, 3)
                    }
                    all_words.append(w_dict)
                    seg_words.append(w_dict)
        whisper_segments.append({
            "text": segment.text.strip(),
            "start": round(segment.start, 3),
            "end": round(segment.end, 3),
            "words": seg_words
        })

    total_duration = round(getattr(info, "duration", 0.0), 3)
    if total_duration <= 0.0 and all_words:
        total_duration = round(all_words[-1]["end"] + 0.3, 3)
    elif total_duration <= 0.0:
        total_duration = 5.0

    system_logger.success(
        "ALIGN",
        f"Transcribed {len(all_words)} words into {len(whisper_segments)} speech segments ({total_duration:.2f}s)"
    )

    if not whisper_segments:
        N = target_segments if target_segments and target_segments > 0 else 1
        dur_per_seg = round(total_duration / N, 3)
        intervals = []
        scene_words = []
        texts = []
        for i in range(N):
            st = round(i * dur_per_seg, 3)
            en = round(min(total_duration, (i + 1) * dur_per_seg), 3)
            intervals.append((st, en))
            scene_words.append([])
            texts.append("")
        return total_duration, intervals, scene_words, texts

    N = target_segments if target_segments and target_segments > 0 else len(whisper_segments)

    if N == len(whisper_segments):
        intervals = []
        scene_words = []
        texts = []
        for i in range(N):
            st = 0.0 if i == 0 else intervals[i-1][1]
            if i == N - 1:
                en = total_duration
            else:
                curr_end = whisper_segments[i]["end"]
                next_start = whisper_segments[i+1]["start"]
                en = round((curr_end + next_start) / 2.0, 3) if next_start >= curr_end else curr_end
            intervals.append((st, en))
            scene_words.append(whisper_segments[i]["words"])
            texts.append(whisper_segments[i]["text"])
        return total_duration, intervals, scene_words, texts

    elif N < len(whisper_segments):
        intervals = []
        scene_words = []
        texts = []
        group_size = len(whisper_segments) / float(N)
        for i in range(N):
            start_idx = int(round(i * group_size))
            end_idx = int(round((i + 1) * group_size))
            if i == N - 1:
                end_idx = len(whisper_segments)
            grouped = whisper_segments[start_idx:end_idx]
            if not grouped:
                grouped = [whisper_segments[min(start_idx, len(whisper_segments) - 1)]]

            st = 0.0 if i == 0 else intervals[i-1][1]
            if i == N - 1:
                en = total_duration
            else:
                curr_end = grouped[-1]["end"]
                next_start = whisper_segments[min(end_idx, len(whisper_segments) - 1)]["start"]
                en = round((curr_end + next_start) / 2.0, 3) if next_start >= curr_end else curr_end

            intervals.append((st, en))
            g_words = []
            g_texts = []
            for g in grouped:
                g_words.extend(g["words"])
                if g["text"]:
                    g_texts.append(g["text"])
            scene_words.append(g_words)
            texts.append(" ".join(g_texts))
        return total_duration, intervals, scene_words, texts

    else:
        dur_per_seg = round(total_duration / N, 3)
        intervals = []
        scene_words = []
        texts = []
        for i in range(N):
            st = round(i * dur_per_seg, 3)
            en = round(min(total_duration, (i + 1) * dur_per_seg), 3) if i < N - 1 else total_duration
            intervals.append((st, en))
            w_in_int = [w for w in all_words if st <= w["start"] < en]
            scene_words.append(w_in_int)
            texts.append(" ".join(w["word"] for w in w_in_int))
        return total_duration, intervals, scene_words, texts

