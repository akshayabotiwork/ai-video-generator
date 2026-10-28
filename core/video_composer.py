import os
import re
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Callable
from config import FFMPEG_EXE, TEMP_DIR, OUTPUT_DIR, STORAGE_DIR
from core.graphics_generator import GraphicsGenerator
from core.subtitle_styler import SubtitleStyler
from core.audio_mixer import AudioMixer, _resolve_audio_file
from core.logger import system_logger

def _resolve_img_path(p: Optional[str]) -> str:
    if not p:
        return ""
    if os.path.exists(p):
        return p
    norm = str(p).replace("\\", "/")
    if "/storage/" in norm:
        cand = STORAGE_DIR / norm.split("/storage/", 1)[1]
        if cand.exists():
            return str(cand)
    elif (STORAGE_DIR / norm.lstrip("/")).exists():
        return str(STORAGE_DIR / norm.lstrip("/"))
    return str(p)

# Supported FFmpeg xfade transition names
VALID_XFADE_TRANSITIONS = {
    "fade", "wipeleft", "wiperight", "wipeup", "wipedown",
    "slideleft", "slideright", "slideup", "slidedown",
    "circlecrop", "rectcrop", "dissolve", "fadeblack", "fadewhite",
    "radial", "smoothleft", "smoothright", "zoomin"
}

class VideoComposer:
    """
    Unified Single-Timeline Video Composer for AI News Video Broadcasts.
    Renders all scenes directly on a single continuous timeline with Ken Burns motion,
    dynamic xfade transitions, synchronized audio, lower-third overlays, and subtitles
    in a single high-efficiency FFmpeg rendering pass.
    """

    def __init__(self, temp_dir: Path = TEMP_DIR, output_dir: Path = OUTPUT_DIR):
        self.temp_dir = temp_dir
        self.output_dir = output_dir
        self.graphics_gen = GraphicsGenerator(temp_dir)
        self.subtitle_styler = SubtitleStyler(temp_dir)
        self.audio_mixer = AudioMixer(temp_dir)

    def compute_timeline_schedule(
        self,
        scenes_data: List[Dict[str, Any]],
        default_transition: str = "fade",
        default_transition_duration: float = 0.5,
        max_shot_duration: Optional[float] = None
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Calculates exact mathematical timestamps for all scenes on the master timeline.
        Guarantees zero-drift audio/visual sync with transitions.
        
        Formula:
          For scene i in [0..N-1]:
            A_i = max(audio_duration_i, min_shot_duration)
            T_i = transition_duration (clamped <= A_i * 0.3)
            visual_duration_i = A_i + T_i (if i < N-1) else A_i
            timeline_start_i = sum(A_0 .. A_{i-1})
            timeline_end_i = timeline_start_i + A_i
            xfade_offset_i = timeline_end_i = sum(A_0 .. A_i)
            
          Total video duration = sum(A_0 .. A_{N-1}) = total master audio duration.
        """
        if not scenes_data:
            raise ValueError("No scenes provided to compute timeline schedule.")

        num_scenes = len(scenes_data)
        scheduled = []
        current_time = 0.0

        # Read global motion & visual pacing configurations
        import config
        motion_cfg = getattr(config, "MOTION_CONFIG", {})

        if max_shot_duration is not None and float(max_shot_duration) > 0:
            MAX_PHOTO_DURATION = float(max_shot_duration)
        else:
            MAX_PHOTO_DURATION = float(motion_cfg.get("max_shot_duration", getattr(config, "MAX_SCENE_INTERVAL", 3.0)))

        MIN_SHOT_DURATION = float(motion_cfg.get("min_shot_duration", 1.5))
        CONFIG_DEFAULT_TRANSITION = str(motion_cfg.get("default_transition", "fade"))
        CONFIG_TRANSITION_DURATION = float(motion_cfg.get("transition_duration", 0.5))
        CONFIG_MOTION_STYLES = list(motion_cfg.get("motion_styles", ["zoom_in", "pan_right", "zoom_out", "pan_left"]))

        for idx, scene in enumerate(scenes_data):
            # Check if pre-scheduled from continuous narration
            preset_start = float(scene.get("timeline_start", 0.0))
            preset_end = float(scene.get("timeline_end", 0.0))
            if preset_end > preset_start:
                t_start = preset_start
                t_end = preset_end
                allotted_dur = round(t_end - t_start, 3)
            else:
                raw_dur = float(scene.get("audio_duration", 0.0))
                allotted_dur = max(raw_dur, MIN_SHOT_DURATION)
                t_start = current_time
                t_end = round(t_start + allotted_dur, 3)

            # Available image assets for this scene (rotate across sub-shots if multiple photos downloaded)
            scene_images = [_resolve_img_path(p) for p in (scene.get("all_media_paths") or []) if p and not str(p).endswith("_card.jpg")]
            scene_images = [p for p in scene_images if p and os.path.exists(p)]
            if not scene_images and scene.get("local_media_path"):
                resolved_prim = _resolve_img_path(scene.get("local_media_path"))
                if resolved_prim:
                    scene_images = [resolved_prim]
            if not scene_images:
                scene_images = [""]

            is_scene_last = (idx == num_scenes - 1)

            threshold = MAX_PHOTO_DURATION * 0.5
            full_shots = int(allotted_dur // MAX_PHOTO_DURATION)
            remainder = round(allotted_dur - (full_shots * MAX_PHOTO_DURATION), 3)

            if allotted_dur > MAX_PHOTO_DURATION:
                if remainder >= threshold:
                    shot_durations = [MAX_PHOTO_DURATION] * full_shots + [remainder]
                else:
                    if full_shots > 1:
                        shot_durations = [MAX_PHOTO_DURATION] * (full_shots - 1) + [round(MAX_PHOTO_DURATION + remainder, 3)]
                    else:
                        shot_durations = [allotted_dur]
            else:
                shot_durations = [allotted_dur]

            num_sub_shots = len(shot_durations)

            if num_sub_shots > 1:
                # Sub-divide long scene: First part keeps MAX_PHOTO_DURATION, next part gets remainder (>50% threshold)
                cur_start = t_start
                for k in range(num_sub_shots):
                    sub_dur = shot_durations[k]
                    sub_start = round(cur_start, 3)
                    sub_end = round(sub_start + sub_dur, 3) if k < num_sub_shots - 1 else t_end
                    sub_allotted = round(sub_end - sub_start, 3)
                    cur_start = sub_end

                    # Strictly pick next distinct image for each cut (Photo 1, Photo 2, Photo 3)
                    sub_image = scene_images[k] if k < len(scene_images) else scene_images[k % len(scene_images)]

                    # Keep AI's chosen motion for primary cut, complement subsequent cuts from config
                    if k == 0 and scene.get("motion_style"):
                        sub_motion = scene.get("motion_style")
                    else:
                        sub_motion = CONFIG_MOTION_STYLES[k % len(CONFIG_MOTION_STYLES)]

                    sub_trans = str(scene.get("transition_type") or default_transition or CONFIG_DEFAULT_TRANSITION).lower().strip().replace("_", "")
                    if sub_trans not in VALID_XFADE_TRANSITIONS:
                        sub_trans = CONFIG_DEFAULT_TRANSITION

                    sub_tdur = round(max(0.1, min(CONFIG_TRANSITION_DURATION, 0.5, sub_allotted * 0.3)), 3)

                    is_global_last = (is_scene_last and k == num_sub_shots - 1)
                    sub_visual_dur = round(sub_allotted + sub_tdur, 3) if not is_global_last else sub_allotted

                    sc = dict(scene)
                    sc.update({
                        "scene_index": len(scheduled),
                        "local_media_path": sub_image,
                        "motion_style": sub_motion,
                        "transition_type": sub_trans,
                        "transition_duration": sub_tdur,
                        "allotted_duration": sub_allotted,
                        "visual_duration": sub_visual_dur,
                        "timeline_start": sub_start,
                        "timeline_end": sub_end,
                        "xfade_offset": sub_end,
                        "audio_offset": round(float(scene.get("audio_offset", 0.0)) + (sub_start - t_start), 3)
                    })
                    scheduled.append(sc)
            else:
                # Normal scene <= MAX_PHOTO_DURATION
                trans_type = str(scene.get("transition_type") or default_transition or CONFIG_DEFAULT_TRANSITION).lower().strip().replace("_", "")
                if trans_type not in VALID_XFADE_TRANSITIONS:
                    trans_type = CONFIG_DEFAULT_TRANSITION

                raw_trans_dur = float(scene.get("transition_duration") or default_transition_duration or CONFIG_TRANSITION_DURATION)
                trans_dur = round(max(0.1, min(raw_trans_dur, 0.5, allotted_dur * 0.3)), 3)
                visual_dur = round(allotted_dur + trans_dur, 3) if not is_scene_last else allotted_dur

                sc = dict(scene)
                sc.update({
                    "scene_index": len(scheduled),
                    "local_media_path": scene_images[0],
                    "motion_style": scene.get("motion_style") or CONFIG_MOTION_STYLES[0],
                    "allotted_duration": allotted_dur,
                    "visual_duration": visual_dur,
                    "transition_type": trans_type,
                    "transition_duration": trans_dur,
                    "timeline_start": t_start,
                    "timeline_end": t_end,
                    "xfade_offset": t_end,
                    "audio_offset": round(float(scene.get("audio_offset", 0.0)), 3)
                })
                scheduled.append(sc)

            current_time = max(current_time, t_end)

        total_duration = current_time
        return scheduled, total_duration

    def render_full_video(
        self,
        scenes_data: List[Dict[str, Any]],
        project_title: str,
        theme_key: str = "breaking_news",
        aspect_ratio: str = "16:9",
        include_subtitles: bool = True,
        include_ticker: bool = False,
        include_music: bool = True,
        default_transition: str = "fade",
        transition_duration: float = 0.5,
        master_audio_path: Optional[str] = None,
        progress_callback: Optional[Callable[[int], None]] = None,
        max_shot_duration: Optional[float] = None,
        soundbed_path: Optional[str] = None,
        soundbed_volume: Optional[float] = None,
        cancel_checker: Optional[Callable[[], bool]] = None,
        register_process: Optional[Callable[[Any], None]] = None
    ) -> str:
        """
        Renders multiple images into a single continuous broadcast video on a unified timeline.
        Transitions smoothly between images, keeps audio and script narration strictly in sync,
        and overlays dynamic subtitles in a single FFmpeg pass.
        """
        if not scenes_data:
            raise ValueError("No scenes provided for video rendering.")

        if progress_callback:
            progress_callback(10)

        is_vertical = (aspect_ratio == "9:16")
        width = 1080 if is_vertical else 1920
        height = 1920 if is_vertical else 1080
        fps = 30

        # Step 1: Compute Exact Timeline Schedule (expands long scenes into visual shots bounded by max_shot_duration)
        scheduled_scenes, total_duration = self.compute_timeline_schedule(
            scenes_data=scenes_data,
            default_transition=default_transition,
            default_transition_duration=transition_duration,
            max_shot_duration=max_shot_duration
        )
        num_scenes = len(scheduled_scenes)

        if progress_callback:
            progress_callback(20)

        # Step 2: Prepare canvas images and Lower-Third Overlays (if enabled)
        prepared_images = []
        overlay_images = []

        for shot_idx, sc in enumerate(scheduled_scenes):
            raw_img = sc.get("local_media_path", "")
            
            # Prepare formatted canvas image for this shot
            prepared_img = self.temp_dir / f"shot_{shot_idx}_prepared.jpg"
            self.graphics_gen.prepare_canvas_image(raw_img, str(prepared_img), aspect_ratio)
            prepared_images.append(str(prepared_img))

            # Generate transparent lower-third overlay PNG only if ticker enabled
            if include_ticker:
                overlay_png = self.graphics_gen.generate_lower_third_overlay(
                    headline=sc.get("lower_third_headline", ""),
                    category_tag=sc.get("category_tag", "NEWS"),
                    theme_key=theme_key,
                    aspect_ratio=aspect_ratio,
                    scene_id=shot_idx + 1
                )
                overlay_images.append(str(overlay_png))

        if progress_callback:
            progress_callback(40)

        # Step 3: Master Narration Audio (Continuous Unbroken Track)
        if master_audio_path and os.path.exists(master_audio_path):
            master_narration = Path(master_audio_path)
        else:
            master_narration = self.temp_dir / "master_synchronized_narration.mp3"
            self.audio_mixer.assemble_synchronized_narration_track(
                scene_items=scheduled_scenes,
                output_path=str(master_narration)
            )


        # Step 4: Mix Narration with Music Track (Only if music clip provided)
        resolved_bed = (_resolve_audio_file(soundbed_path) or _resolve_img_path(soundbed_path)) if soundbed_path else ""
        has_custom_music = bool(include_music and resolved_bed and os.path.exists(resolved_bed))
        final_audio = self.temp_dir / "master_mixed_soundtrack.aac"

        if has_custom_music:
            vol = soundbed_volume if soundbed_volume is not None else 1.0
            self.audio_mixer.mix_narration_with_soundbed(
                narration_audio_path=str(master_narration),
                total_duration=total_duration,
                output_path=str(final_audio),
                soundbed_path=resolved_bed,
                ducking_level=vol
            )
        else:
            final_audio = master_narration

        if progress_callback:
            progress_callback(55)

        # Step 5: Generate Synchronized Subtitles (.ass)
        subtitles_file = self.temp_dir / "subtitles_sync.ass"
        if include_subtitles:
            self.subtitle_styler.create_ass_subtitles(
                scenes_data=scheduled_scenes,
                output_path=str(subtitles_file),
                aspect_ratio=aspect_ratio
            )

        if progress_callback:
            progress_callback(65)

        # Step 6: Construct Single-Pass FFmpeg Filter Graph
        cmd = [FFMPEG_EXE, "-y"]
        filter_parts = []

        # Add image inputs (Inputs 0 to num_scenes - 1)
        for idx, sc in enumerate(scheduled_scenes):
            v_dur = sc["visual_duration"]
            img_posix = Path(prepared_images[idx]).as_posix()
            cmd.extend(["-loop", "1", "-t", str(v_dur), "-i", img_posix])

        # Add overlay inputs (Inputs num_scenes to 2*num_scenes - 1)
        overlay_start_idx = num_scenes
        if include_ticker:
            for idx in range(num_scenes):
                over_posix = Path(overlay_images[idx]).as_posix()
                cmd.extend(["-loop", "1", "-t", str(total_duration), "-i", over_posix])

        # Add audio input (Input: overlay_start_idx + num_scenes if ticker, else overlay_start_idx)
        audio_input_idx = overlay_start_idx + (num_scenes if include_ticker else 0)
        cmd.extend(["-i", Path(final_audio).as_posix()])

        # Build Ken Burns Motion Filters for Each Image Stream
        for idx, sc in enumerate(scheduled_scenes):
            v_dur = sc["visual_duration"]
            motion = sc.get("motion_style", "zoom_in")
            focal_point = sc.get("focal_point", "center")
            motion_speed = sc.get("motion_speed", "slow_dramatic")
            total_frames = int(max(v_dur, 1.0) * fps)

            # Determine zoom intensity based on motion_speed
            if motion_speed == "fast_punch":
                zoom_delta = 0.22
                max_zoom = 1.22
            else:  # slow_dramatic / steady_pan
                zoom_delta = 0.12
                max_zoom = 1.12

            # Determine vertical camera anchor based on focal_point
            if focal_point == "top_face":
                y_anchor = "ih*0.35-(ih/zoom*0.35)"
            elif focal_point == "wide_horizon":
                y_anchor = "ih*0.42-(ih/zoom*0.42)"
            else:  # center
                y_anchor = "ih/2-(ih/zoom/2)"

            x_center = "iw/2-(iw/zoom/2)"

            if motion == "zoom_out":
                zoom_expr = f"zoom='if(lte(zoom,1.0),{max_zoom},max(1.001,zoom-{zoom_delta}/{total_frames}))':x='{x_center}':y='{y_anchor}'"
            elif motion == "pan_left":
                zoom_expr = f"zoom={max_zoom}:x='if(lte(on,1),(iw-iw/zoom),max(0,x-(iw-iw/zoom)/{total_frames}))':y='{y_anchor}'"
            elif motion == "pan_right":
                zoom_expr = f"zoom={max_zoom}:x='if(lte(on,1),0,min((iw-iw/zoom),x+(iw-iw/zoom)/{total_frames}))':y='{y_anchor}'"
            elif motion == "static":
                zoom_expr = f"zoom=1.0:x='{x_center}':y='{y_anchor}'"
            else:  # default zoom_in
                zoom_expr = f"zoom='min(zoom+{zoom_delta}/{total_frames},{max_zoom})':x='{x_center}':y='{y_anchor}'"

            filter_parts.append(
                f"[{idx}:v]scale={width*2}:{height*2}:force_original_aspect_ratio=increase,"
                f"crop={width*2}:{height*2},"
                f"zoompan={zoom_expr}:d={total_frames}:s={width}x{height}:fps={fps},"
                f"setpts=PTS-STARTPTS,fps={fps},"
                f"eq=contrast=1.15:saturation=1.1:brightness=-0.05[vm_{idx}]"
            )

        # Chain Consecutive Images with xfade Transitions
        if num_scenes == 1:
            current_video_label = "vm_0"
        else:
            current_video_label = "vx_0"
            first_trans = scheduled_scenes[0]["transition_type"]
            first_tdur = scheduled_scenes[0]["transition_duration"]
            first_offset = scheduled_scenes[0]["xfade_offset"]
            filter_parts.append(
                f"[vm_0][vm_1]xfade=transition={first_trans}:duration={first_tdur}:offset={first_offset}[{current_video_label}]"
            )

            for idx in range(1, num_scenes - 1):
                next_label = f"vx_{idx}"
                next_trans = scheduled_scenes[idx]["transition_type"]
                next_tdur = scheduled_scenes[idx]["transition_duration"]
                next_offset = scheduled_scenes[idx]["xfade_offset"]
                filter_parts.append(
                    f"[{current_video_label}][vm_{idx+1}]xfade=transition={next_trans}:duration={next_tdur}:offset={next_offset}[{next_label}]"
                )
                current_video_label = next_label

        # Overlay Dynamic Lower-Third Tickers on the Unified Stream
        if include_ticker:
            for idx, sc in enumerate(scheduled_scenes):
                next_overlay_label = f"vo_{idx}"
                over_input = overlay_start_idx + idx
                t_s = sc["timeline_start"]
                t_e = sc["timeline_end"]
                # Enable overlay strictly during scene active window
                filter_parts.append(
                    f"[{current_video_label}][{over_input}:v]overlay=0:0:enable='between(t,{t_s},{t_e})'[{next_overlay_label}]"
                )
                current_video_label = next_overlay_label

        # Apply Synchronized Subtitles via ASS filter
        final_video_label = current_video_label
        if include_subtitles and subtitles_file.exists():
            ass_escaped = str(subtitles_file).replace("\\", "/").replace(":", "\\:")
            filter_parts.append(f"[{current_video_label}]ass='{ass_escaped}'[v_subtitled]")
            final_video_label = "v_subtitled"

        # Final Composite Output Path
        safe_title = re.sub(r'[^\w\-_\. ]', '_', project_title)[:30].strip() or "news_broadcast"
        import time
        final_output_mp4 = self.output_dir / f"{safe_title}_{int(total_duration)}s_{int(time.time())}.mp4"

        # Assemble Full Command
        cmd.extend([
            "-filter_complex", ";".join(filter_parts),
            "-map", f"[{final_video_label}]",
            "-map", f"{audio_input_idx}:a",
            "-t", str(total_duration),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            str(final_output_mp4)
        ])

        if progress_callback:
            progress_callback(75)

        # Step 7: Execute FFmpeg Single-Pass Render
        # Stream stderr in real-time via a reader thread to prevent pipe buffer deadlock
        # (the classic subprocess.PIPE hang when FFmpeg output exceeds ~64KB OS buffer)
        import time
        import threading
        import re as _re

        try:
            system_logger.info("COMPOSER", f"Executing FFmpeg single-pass composite engine for {int(total_duration)}s video...")

            # Use -progress pipe:1 for machine-readable progress on stdout;
            # stderr is streamed and drained by a background thread to prevent deadlock
            cmd_with_progress = list(cmd)
            # Insert progress flag before the output file (last element)
            cmd_with_progress.insert(-1, "-progress")
            cmd_with_progress.insert(-1, "pipe:1")

            proc = subprocess.Popen(
                cmd_with_progress,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0
            )
            if register_process:
                register_process(proc)

            # Drain stderr in a background thread to prevent OS pipe buffer deadlock
            stderr_chunks: list = []

            def _drain_stderr():
                try:
                    while True:
                        chunk = proc.stderr.read(4096)
                        if not chunk:
                            break
                        stderr_chunks.append(chunk)
                except Exception:
                    pass

            stderr_thread = threading.Thread(target=_drain_stderr, daemon=True)
            stderr_thread.start()

            # Read stdout line-by-line for FFmpeg progress updates
            last_progress_pct = 75
            stall_start = time.monotonic()
            STALL_TIMEOUT = max(600, total_duration * 15)  # generous timeout

            while proc.poll() is None:
                if cancel_checker and cancel_checker():
                    proc.kill()
                    stderr_thread.join(timeout=2)
                    system_logger.warning("COMPOSER", "FFmpeg render process killed due to user cancellation.")
                    raise RuntimeError("Render cancelled by user")

                # Read a line of progress output (non-blocking via readline)
                try:
                    line = proc.stdout.readline()
                    if line:
                        stall_start = time.monotonic()  # reset stall timer on any output
                        decoded = line.decode("utf-8", errors="ignore").strip()

                        # Parse "out_time_us=<microseconds>" from -progress output
                        if decoded.startswith("out_time_us="):
                            try:
                                us = int(decoded.split("=", 1)[1])
                                elapsed_sec = us / 1_000_000.0
                                if total_duration > 0:
                                    # Map FFmpeg progress to 76-98% range
                                    ffmpeg_pct = min(elapsed_sec / total_duration, 1.0)
                                    mapped_pct = int(76 + ffmpeg_pct * 22)  # 76..98
                                    if mapped_pct > last_progress_pct and progress_callback:
                                        progress_callback(mapped_pct)
                                        last_progress_pct = mapped_pct
                            except (ValueError, ZeroDivisionError):
                                pass

                        # Also parse "out_time=HH:MM:SS.us" as fallback
                        elif decoded.startswith("out_time="):
                            try:
                                ts = decoded.split("=", 1)[1]
                                parts = ts.split(":")
                                if len(parts) == 3:
                                    elapsed_sec = float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
                                    if total_duration > 0:
                                        ffmpeg_pct = min(elapsed_sec / total_duration, 1.0)
                                        mapped_pct = int(76 + ffmpeg_pct * 22)
                                        if mapped_pct > last_progress_pct and progress_callback:
                                            progress_callback(mapped_pct)
                                            last_progress_pct = mapped_pct
                            except (ValueError, IndexError):
                                pass
                    else:
                        time.sleep(0.1)
                except Exception:
                    time.sleep(0.1)

                # Stall detection: kill if FFmpeg produces no output for too long
                if time.monotonic() - stall_start > STALL_TIMEOUT:
                    proc.kill()
                    stderr_thread.join(timeout=2)
                    system_logger.error("COMPOSER", f"FFmpeg render stalled for {STALL_TIMEOUT}s — killed.")
                    raise RuntimeError(f"FFmpeg render stalled (no output for {int(STALL_TIMEOUT)}s)")

            # Wait for stderr thread to finish
            stderr_thread.join(timeout=5)

            return_code = proc.returncode
            if return_code != 0:
                err_msg = b"".join(stderr_chunks).decode("utf-8", errors="ignore") if stderr_chunks else f"Exit code {return_code}"
                system_logger.error("COMPOSER", f"FFmpeg render failure: {str(err_msg)[-300:]}")
                raise RuntimeError(f"FFmpeg Single-Pass Render failed: {str(err_msg)[-400:]}")

            system_logger.success("COMPOSER", f"FFmpeg Single-Pass render completed successfully -> {final_output_mp4.name}")
        except Exception as e:
            if "cancelled" in str(e).lower():
                raise e
            system_logger.error("COMPOSER", f"FFmpeg render failure: {e}")
            raise RuntimeError(f"FFmpeg render error: {e}")

        if progress_callback:
            progress_callback(100)

        return str(final_output_mp4)

    def render_scene_clip(
        self,
        image_path: str,
        duration: float,
        headline: str,
        category_tag: str,
        motion_style: str = "zoom_in",
        theme_key: str = "breaking_news",
        aspect_ratio: str = "16:9",
        scene_id: int = 1
    ) -> str:
        """Standalone preview helper for individual scene rendering if needed."""
        is_vertical = (aspect_ratio == "9:16")
        width = 1080 if is_vertical else 1920
        height = 1920 if is_vertical else 1080
        fps = 30
        total_frames = int(max(duration, 2.0) * fps)

        prepared_img = self.temp_dir / f"scene_{scene_id}_prepared.jpg"
        self.graphics_gen.prepare_canvas_image(image_path, str(prepared_img), aspect_ratio)

        overlay_png = self.graphics_gen.generate_lower_third_overlay(
            headline=headline,
            category_tag=category_tag,
            theme_key=theme_key,
            aspect_ratio=aspect_ratio,
            scene_id=scene_id
        )

        zoom_expr = f"zoom='min(zoom+0.15/{total_frames},1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        scene_out = self.temp_dir / f"scene_{scene_id}_preview.mp4"

        cmd = [
            FFMPEG_EXE, "-y",
            "-loop", "1", "-t", str(duration), "-i", prepared_img.as_posix(),
            "-loop", "1", "-t", str(duration), "-i", Path(overlay_png).as_posix(),
            "-filter_complex",
            f"[0:v]scale={width*2}:{height*2}:force_original_aspect_ratio=increase,crop={width*2}:{height*2},"
            f"zoompan={zoom_expr}:d={total_frames}:s={width}x{height}:fps={fps},setpts=PTS-STARTPTS,fps={fps}[mot];"
            f"[mot][1:v]overlay=0:0[vout]",
            "-map", "[vout]",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            "-t", str(duration),
            str(scene_out)
        ]
        subprocess.run(cmd, capture_output=True, check=True)
        return str(scene_out)
