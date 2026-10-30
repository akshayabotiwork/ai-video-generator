import os
import uuid
from typing import Dict, Any, List, Optional, Callable
from core.models import VideoProject, SceneData, VisualCandidate
from core.director import ScriptDirector
from core.serp_searcher import SerpVisualSearcher
from core.media_downloader import MediaDownloader
from core.audio import TTSEngine
from core.video import VideoComposer
from core.logger import system_logger
from config import SERPAPI_API_KEY, DEFAULT_VOICES

class NewsVideoPipeline:
    """End-to-End Orchestrator for AI News Video Generation."""

    def __init__(self, serp_api_key: str = "", openai_key: str = "", gemini_key: str = ""):
        self.director = ScriptDirector(openai_api_key=openai_key, gemini_api_key=gemini_key)
        self.searcher = SerpVisualSearcher(api_key=serp_api_key or SERPAPI_API_KEY)
        self.downloader = MediaDownloader()
        self.tts = TTSEngine()
        self.composer = VideoComposer()

    def parse_script_to_storyboard(
        self,
        script_text: str,
        category: str = "general",
        project_title: str = "AI Video Story",
        aspect_ratio: str = "16:9"
    ) -> VideoProject:
        """Step 1: Analyzes script and populates scenes with search queries and initial metadata."""
        word_count = len(script_text.split())
        system_logger.info("DIRECTOR", f"Parsing script: '{project_title}' ({word_count} words, category: {category}, format: {aspect_ratio})")
        scenes = self.director.segment_script(
            script_text,
            category=category,
            project_title=project_title,
            aspect_ratio=aspect_ratio
        )
        
        project = VideoProject(
            project_id=str(uuid.uuid4())[:8],
            title=project_title,
            raw_script=script_text,
            category=category,
            aspect_ratio=aspect_ratio,
            scenes=scenes,
            status="parsed",
            progress_percent=20
        )
        system_logger.success(
            "DIRECTOR",
            f"Storyboard ready: {len(scenes)} scenes segmented for project '{project.project_id}'",
            {"scenes": len(scenes), "category": category, "aspect_ratio": aspect_ratio}
        )
        return project

    def discover_media_for_project(self, project: VideoProject) -> VideoProject:
        """Step 2: Uses SERP API and contextual ranker to find multiple high-quality visuals for each scene."""
        system_logger.info("SERP", f"Searching visuals for {len(project.scenes)} scenes (Category: {project.category})...")
        for scene in project.scenes:
            system_logger.info("SERP", f"Scene {scene.scene_id}: Query '{scene.search_query}' (Entity: '{scene.primary_entity}')")
            candidates = self.searcher.search_for_scene(scene, category=project.category, limit=8)
            scene.visual_candidates = candidates
            
            # Download up to 3 validated high-resolution images per scene to support visual pacing
            valid_images = []
            for cand_idx, cand in enumerate(candidates[:6]):
                if cand.image_url:
                    local_path = self.downloader.download_and_validate(
                        url=cand.image_url,
                        scene_id=f"{scene.scene_id}_{len(valid_images) + 1}",
                        fallback_headline=scene.lower_third_headline,
                        category_tag=scene.category_tag,
                        generate_fallback=False,
                        fallback_url=cand.thumbnail_url or ""
                    )
                    # If valid photo downloaded
                    if local_path and not local_path.endswith("_card.jpg") and os.path.exists(local_path):
                        valid_images.append(local_path)
                        if not scene.selected_visual:
                            scene.selected_visual = cand
                        if len(valid_images) >= 3:
                            break

            # Context Continuity Fallback:
            # If no photos downloaded for this scene, check if previous scenes in the same story have valid photos
            if not valid_images:
                current_idx = project.scenes.index(scene)
                for prev in reversed(project.scenes[:current_idx]):
                    real_photos = [p for p in prev.all_media_paths if not p.endswith("_card.jpg") and os.path.exists(p)]
                    if real_photos:
                        fallback_pic = real_photos[min(1, len(real_photos) - 1)] if len(real_photos) > 1 else real_photos[0]
                        valid_images.append(fallback_pic)
                        scene.selected_visual = prev.selected_visual
                        system_logger.info(
                            "DOWNLOADER",
                            f"Scene {scene.scene_id}: Context visual preserved using authentic photo from Scene {prev.scene_id}"
                        )
                        break

            if valid_images:
                scene.local_media_path = valid_images[0]
                scene.all_media_paths = valid_images
                system_logger.success(
                    "DOWNLOADER",
                    f"Scene {scene.scene_id}: {len(valid_images)} photos verified and cached"
                )
            else:
                # Generate clean broadcast fallback card
                card_path = self.downloader._generate_fallback_card(
                    scene_id=scene.scene_id,
                    headline=scene.lower_third_headline,
                    category_tag=scene.category_tag
                )
                scene.local_media_path = card_path
                scene.all_media_paths = [card_path]
                if candidates:
                    scene.selected_visual = candidates[0]
                system_logger.warning(
                    "DOWNLOADER",
                    f"Scene {scene.scene_id}: Photo download fallback used. Broadcast graphic card generated."
                )

        project.status = "media_selected"
        project.progress_percent = 50
        system_logger.success("SERP", f"Visual assets populated for all {len(project.scenes)} scenes.")
        return project

    def generate_narration_for_project(self, project: VideoProject) -> VideoProject:
        """Step 3: Synthesizes individual scene voiceover audio and timestamps for each scene."""
        system_logger.info("TTS", f"Synthesizing voiceover with voice '{project.voice}' for {len(project.scenes)} scenes...")
        running_timeline = 0.0

        for scene in project.scenes:
            audio_path, duration, word_times = self.tts.generate_speech(
                text=scene.narration_text,
                scene_id=scene.scene_id,
                voice=project.voice
            )
            scene.local_audio_path = audio_path
            scene.audio_duration = round(duration, 3)
            scene.timeline_start = round(running_timeline, 3)
            scene.timeline_end = round(running_timeline + duration, 3)
            scene.word_timestamps = word_times
            running_timeline = scene.timeline_end

        project.total_timeline_duration = round(running_timeline, 3)
        project.master_audio_path = None
        project.progress_percent = 70
        system_logger.success(
            "TTS",
            f"All {len(project.scenes)} scenes synthesized. Total timeline duration: {project.total_timeline_duration:.2f}s."
        )
        return project

    def render_project_video(
        self,
        project: VideoProject,
        progress_callback: Optional[Callable[[int], None]] = None,
        cancel_checker: Optional[Callable[[], bool]] = None,
        register_process: Optional[Callable[[Any], None]] = None
    ) -> str:
        """Step 4: Executes unified single-timeline FFmpeg compositing, overlays, subtitles, and export."""
        project.status = "rendering"
        system_logger.info(
            "COMPOSER",
            f"Starting single-pass FFmpeg export for '{project.title}' "
            f"(Aspect: {project.aspect_ratio}, Theme: {project.theme}, Subtitles: {project.include_subtitles})"
        )
        
        # Prepare scenes dictionary payload for composer
        scenes_payload = []
        for s in project.scenes:
            scenes_payload.append({
                "scene_id": s.scene_id,
                "narration_text": s.narration_text,
                "lower_third_headline": s.lower_third_headline,
                "category_tag": s.category_tag,
                "motion_style": s.motion_style,
                "transition_type": s.transition_type,
                "transition_duration": s.transition_duration,
                "timeline_start": s.timeline_start,
                "timeline_end": s.timeline_end,
                "local_media_path": s.local_media_path,
                "all_media_paths": s.all_media_paths if (s.all_media_paths and len(s.all_media_paths) > 0) else ([s.local_media_path] if s.local_media_path else []),
                "local_audio_path": s.local_audio_path,
                "audio_duration": s.audio_duration,
                "audio_offset": getattr(s, "audio_offset", 0.0),
                "audio_volume": getattr(s, "audio_volume", 1.0),
                "word_timestamps": s.word_timestamps,
                "visual_category": getattr(s, "visual_category", "dynamic_action"),
                "focal_point": getattr(s, "focal_point", "center"),
                "motion_speed": getattr(s, "motion_speed", "slow_dramatic"),
                "chapter_marker": getattr(s, "chapter_marker", "")
            })

        output_video_path = self.composer.render_full_video(
            scenes_data=scenes_payload,
            project_title=project.title,
            theme_key=project.theme,
            aspect_ratio=project.aspect_ratio,
            include_subtitles=project.include_subtitles,
            include_ticker=project.include_ticker,
            include_music=project.include_background_music,
            default_transition=project.default_transition,
            transition_duration=project.transition_duration,
            master_audio_path=project.master_audio_path,
            progress_callback=progress_callback,
            max_shot_duration=getattr(project, "max_shot_duration", None),
            soundbed_path=getattr(project, "soundbed_path", None),
            soundbed_volume=getattr(project, "soundbed_volume", None),
            cancel_checker=cancel_checker,
            register_process=register_process
        )

        project.output_video_path = output_video_path
        project.status = "completed"
        project.progress_percent = 100
        system_logger.success("COMPOSER", f"Render finished: Broadcast MP4 exported -> {output_video_path}")
        return output_video_path


    def run_end_to_end(
        self,
        script_text: str,
        category: str = "news",
        project_title: str = "AI News Video",
        theme: str = "breaking_news",
        aspect_ratio: str = "16:9",
        voice: str = "en-US-GuyNeural",
        include_subtitles: bool = True,
        include_ticker: bool = False,
        include_music: bool = True,
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> VideoProject:
        """Executes full automated pipeline from raw script to rendered broadcast video."""
        if progress_callback:
            progress_callback(5)

        # 1. Parse Script
        project = self.parse_script_to_storyboard(script_text, category, project_title)
        project.theme = theme
        project.aspect_ratio = aspect_ratio
        project.voice = voice
        project.include_subtitles = include_subtitles
        project.include_ticker = include_ticker
        project.include_background_music = include_music

        if progress_callback:
            progress_callback(25)

        # 2. Search & Download Visuals via SERP API
        self.discover_media_for_project(project)

        if progress_callback:
            progress_callback(55)

        # 3. Generate Voice & Timestamps
        self.generate_narration_for_project(project)

        if progress_callback:
            progress_callback(75)

        # 4. Render FFmpeg Video
        self.render_project_video(project, progress_callback=progress_callback)

        return project
