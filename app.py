import os
import re
import time
import shutil
import uuid
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional, List
import json
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import (
    BASE_DIR, STORAGE_DIR, TEMP_DIR, MEDIA_DIR, OUTPUT_DIR,
    THEMES, DEFAULT_VOICES, SERPAPI_API_KEY,
    MAX_SCENE_INTERVAL, MOTION_CONFIG
)
from core.models import VideoProject, SceneData, VisualCandidate
from core.pipeline import NewsVideoPipeline
from core.logger import system_logger, attach_logging_handler

app = FastAPI(title="AI News Video Generator Studio", version="1.0.0")

# Attach python logging handler
attach_logging_handler()

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for active projects
ACTIVE_PROJECTS: Dict[str, VideoProject] = {}

# Mount storage directories for static file access (images, audio, videos)
app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

# Request Models
class ParseScriptRequest(BaseModel):
    script_text: str
    category: str = "news"
    project_title: str = "AI News Video"
    theme: str = "breaking_news"
    aspect_ratio: str = "16:9"
    voice: str = "en-US-GuyNeural"
    serp_api_key: Optional[str] = None
    openai_key: Optional[str] = None
    gemini_key: Optional[str] = None
    max_shot_duration: Optional[float] = None

class SearchMediaRequest(BaseModel):
    query: str
    category: str = "news"
    serp_api_key: Optional[str] = None

class SelectMediaRequest(BaseModel):
    project_id: str
    scene_id: int
    image_url: str
    thumbnail_url: Optional[str] = None
    title: str = ""
    source: str = ""
    shot_index: int = 0

class UpdateSceneRequest(BaseModel):
    project_id: str
    scene_id: int
    narration_text: Optional[str] = None
    lower_third_headline: Optional[str] = None
    category_tag: Optional[str] = None
    motion_style: Optional[str] = None
    transition_type: Optional[str] = None
    transition_duration: Optional[float] = None

class AlignCustomAudioRequest(BaseModel):
    project_id: Optional[str] = None
    audio_url: str
    scenes: Optional[List[Dict[str, Any]]] = None
    num_visual_clips: Optional[int] = None

class RenderProjectRequest(BaseModel):
    project_id: str
    include_subtitles: bool = True
    include_ticker: bool = False
    include_music: bool = True
    default_transition: str = "fade"
    transition_duration: float = 0.5
    max_shot_duration: Optional[float] = None
    scenes: Optional[List[Dict[str, Any]]] = None
    custom_soundbed_path: Optional[str] = None
    soundbed_volume: Optional[float] = None

class ClientLogRequest(BaseModel):
    level: str = "INFO"
    source: str = "UI"
    message: str
    details: Optional[Any] = None



@app.get("/api/config")
async def get_system_config():
    """Returns available themes, voices, transitions, and default settings."""
    return {
        "themes": THEMES,
        "voices": DEFAULT_VOICES,
        "has_serp_key": bool(SERPAPI_API_KEY),
        "max_scene_interval": MAX_SCENE_INTERVAL,
        "motion_config": MOTION_CONFIG,
        "transitions": [
            {"id": "fade", "name": "Crossfade (Broadcast Standard)"},
            {"id": "wipeleft", "name": "Wipe Left"},
            {"id": "wiperight", "name": "Wipe Right"},
            {"id": "slideleft", "name": "Slide Left"},
            {"id": "slideright", "name": "Slide Right"},
            {"id": "smoothleft", "name": "Smooth Push Left"},
            {"id": "circlecrop", "name": "Circle Iris Open"},
            {"id": "dissolve", "name": "Dissolve Grain"},
            {"id": "radial", "name": "Radial Sweep"},
            {"id": "zoomin", "name": "Zoom In"}
        ],
        "aspect_ratios": [
            {"id": "16:9", "name": "16:9 Landscape (YouTube / TV / Web)", "width": 1920, "height": 1080},
            {"id": "9:16", "name": "9:16 Portrait (Shorts / Reels / TikTok)", "width": 1080, "height": 1920}
        ],
        "categories": [
            {"id": "general", "name": "Creative Story & Cinematic (General)", "default_theme": "tech_pulse"},
            {"id": "shorts_reels", "name": "YouTube Shorts / Reels / Viral Facts", "default_theme": "tech_pulse"},
            {"id": "history_mythology", "name": "History, Mythology & Ancient Civilizations", "default_theme": "documentary"},
            {"id": "mystery_crime", "name": "Crime, Mystery & Thriller / Investigation", "default_theme": "documentary"},
            {"id": "horror_paranormal", "name": "Horror, Paranormal & Spooky Legends", "default_theme": "documentary"},
            {"id": "motivation_mindset", "name": "Motivation, Mindset & Life Lessons", "default_theme": "tech_pulse"},
            {"id": "finance_crypto", "name": "Finance, Stock Market & Crypto", "default_theme": "financial_wire"},
            {"id": "science_space", "name": "Science, Space, Universe & Cosmos", "default_theme": "tech_pulse"},
            {"id": "tech_ai", "name": "Tech, AI, Gadgets & Future Innovations", "default_theme": "tech_pulse"},
            {"id": "health_wellness", "name": "Health, Fitness, Diet & Wellness", "default_theme": "tech_pulse"},
            {"id": "nature_travel", "name": "Nature, Wildlife, Travel & Adventure", "default_theme": "documentary"},
            {"id": "sports", "name": "Sports, Football, Cricket & Athletes", "default_theme": "sports_center"},
            {"id": "biography", "name": "Biographies, Historical Figures & Legends", "default_theme": "documentary"},
            {"id": "education_explainer", "name": "Educational, How-To & Deep-Dive Explainer", "default_theme": "tech_pulse"},
            {"id": "news", "name": "Breaking News & Global Affairs", "default_theme": "breaking_news"}
        ]
    }



@app.post("/api/parse-script")
def parse_script(req: ParseScriptRequest):
    """Step 1: Analyzes raw script, breaks into scenes, discovers candidate media, and generates storyboard."""
    if not req.script_text.strip():
        raise HTTPException(status_code=400, detail="Script text cannot be empty.")

    system_logger.info("API", f"POST /api/parse-script: '{req.project_title}' ({req.category}, {req.theme}, {req.voice}, {req.aspect_ratio})")

    try:
        pipeline = NewsVideoPipeline(
            serp_api_key=req.serp_api_key or "",
            openai_key=req.openai_key or "",
            gemini_key=req.gemini_key or ""
        )

        # 1. Parse Script to Storyboard with Title and Aspect Ratio context
        project = pipeline.parse_script_to_storyboard(
            script_text=req.script_text,
            category=req.category,
            project_title=req.project_title,
            aspect_ratio=req.aspect_ratio or "16:9"
        )
        project.theme = req.theme
        project.aspect_ratio = req.aspect_ratio
        project.voice = req.voice
        if req.max_shot_duration is not None and req.max_shot_duration > 0:
            project.max_shot_duration = req.max_shot_duration

        # 2. Discover Media Candidates for each scene
        pipeline.discover_media_for_project(project)

        # 3. Generate Scene Narration & Timings
        pipeline.generate_narration_for_project(project)

        # Store project
        ACTIVE_PROJECTS[project.project_id] = project
        system_logger.success("API", f"Project '{project.project_id}' successfully created with {len(project.scenes)} scenes.")

        return {
            "success": True,
            "project": project.model_dump()
        }
    except Exception as e:
        system_logger.error("API", f"Script generation / parsing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")


@app.post("/api/search-media")
def search_media(req: SearchMediaRequest):
    """Searches SERP API for contextual visuals based on custom search query."""
    system_logger.info("API", f"POST /api/search-media: query='{req.query}' (Category: {req.category})")
    pipeline = NewsVideoPipeline(serp_api_key=req.serp_api_key or "")
    
    # Create dummy scene to leverage ranking
    dummy_scene = SceneData(
        scene_id=0,
        narration_text="",
        search_query=req.query,
        primary_entity=req.query.split()[0] if req.query else ""
    )
    candidates = pipeline.searcher.search_for_scene(dummy_scene, category=req.category, limit=8)
    system_logger.success("API", f"SERP search found {len(candidates)} visual candidates for '{req.query}'")
    return {
        "success": True,
        "candidates": [c.model_dump() for c in candidates]
    }


@app.post("/api/select-media")
def select_media(req: SelectMediaRequest):
    """Updates the selected visual for a scene and downloads it."""
    system_logger.info("API", f"POST /api/select-media: Scene {req.scene_id} -> '{req.title or req.image_url[:50]}'")
    project = ACTIVE_PROJECTS.get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    target_scene = None
    for scene in project.scenes:
        if scene.scene_id == req.scene_id:
            target_scene = scene
            break

    if not target_scene:
        raise HTTPException(status_code=404, detail="Scene not found.")

    shot_idx = max(0, getattr(req, "shot_index", 0))

    # Download and validate with thumbnail fallback
    pipeline = NewsVideoPipeline()
    local_path = pipeline.downloader.download_and_validate(
        url=req.image_url,
        scene_id=f"{target_scene.scene_id}_{shot_idx + 1}",
        fallback_headline=target_scene.lower_third_headline,
        category_tag=target_scene.category_tag,
        generate_fallback=True,
        fallback_url=req.thumbnail_url or ""
    )

    # Initialize all_media_paths if needed
    if not target_scene.all_media_paths:
        target_scene.all_media_paths = [target_scene.local_media_path or local_path]

    # Pad if shot_index is beyond current length
    while len(target_scene.all_media_paths) <= shot_idx:
        target_scene.all_media_paths.append(target_scene.local_media_path or local_path)

    target_scene.all_media_paths[shot_idx] = local_path

    if shot_idx == 0:
        new_candidate = VisualCandidate(
            title=req.title,
            source=req.source,
            image_url=req.image_url,
            thumbnail_url=req.thumbnail_url or req.image_url
        )
        target_scene.selected_visual = new_candidate
        target_scene.local_media_path = local_path

    system_logger.success("API", f"Scene {req.scene_id} [Shot {shot_idx + 1}] visual updated -> {local_path}")

    return {
        "success": True,
        "scene": target_scene.model_dump()
    }


@app.post("/api/update-scene")
async def update_scene(req: UpdateSceneRequest):
    """Updates narration, headline, category, or motion style for a specific scene."""
    project = ACTIVE_PROJECTS.get(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    target_scene = next((s for s in project.scenes if s.scene_id == req.scene_id), None)
    if not target_scene:
        raise HTTPException(status_code=404, detail="Scene not found.")

    system_logger.info("API", f"POST /api/update-scene: Scene {req.scene_id} modified")

    if req.narration_text is not None:
        target_scene.narration_text = req.narration_text
        # Regenerate audio for this scene
        pipeline = NewsVideoPipeline()
        audio_path, dur, word_times = pipeline.tts.generate_speech(
            text=target_scene.narration_text,
            scene_id=target_scene.scene_id,
            voice=project.voice
        )
        target_scene.local_audio_path = audio_path
        target_scene.audio_duration = dur
        target_scene.word_timestamps = word_times

        # Recalculate timeline schedule for entire project
        curr_time = 0.0
        for s in project.scenes:
            allotted = max(s.audio_duration, 2.5)
            s.timeline_start = curr_time
            s.timeline_end = curr_time + allotted
            curr_time += allotted
        project.total_timeline_duration = curr_time

    if req.lower_third_headline is not None:
        target_scene.lower_third_headline = req.lower_third_headline

    if req.category_tag is not None:
        target_scene.category_tag = req.category_tag

    if req.motion_style is not None:
        target_scene.motion_style = req.motion_style

    if req.transition_type is not None:
        target_scene.transition_type = req.transition_type

    if req.transition_duration is not None:
        target_scene.transition_duration = float(req.transition_duration)

    return {
        "success": True,
        "scene": target_scene.model_dump(),
        "total_timeline_duration": project.total_timeline_duration,
        "scenes": [s.model_dump() for s in project.scenes]
    }


@app.post("/api/upload-audio")
async def api_upload_audio(file: UploadFile = File(...)):
    """
    Receives an uploaded audio file from OpenReel timeline for Whisper alignment.
    """
    uploads_dir = STORAGE_DIR / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    save_path = uploads_dir / filename
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "success": True,
        "url": f"/storage/uploads/{filename}",
        "filename": filename,
        "local_path": str(save_path)
    }


@app.post("/api/align-custom-audio")
async def api_align_custom_audio(req: AlignCustomAudioRequest):
    """
    Transcribes user's custom audio using local Faster-Whisper to extract word boundaries,
    and aligns script scenes / timeline visual cuts to exact speech pauses with millisecond accuracy.
    """
    from core.audio_aligner import align_custom_audio, auto_segment_audio

    # 1. Resolve local audio path
    audio_path = None
    url = req.audio_url or ""
    if url.startswith("/storage/"):
        audio_path = BASE_DIR / url.lstrip("/")
    elif "storage/" in url:
        part = url.split("storage/", 1)[1]
        audio_path = STORAGE_DIR / part
    elif os.path.exists(url):
        audio_path = Path(url)

    if not audio_path or not audio_path.exists():
        candidate = MEDIA_DIR / Path(url).name
        if candidate.exists():
            audio_path = candidate
        else:
            upload_candidate = STORAGE_DIR / "uploads" / Path(url).name
            if upload_candidate.exists():
                audio_path = upload_candidate
            else:
                raise HTTPException(status_code=400, detail=f"Audio file not found on server: {req.audio_url}")

    # 2. Extract scene texts
    project = ACTIVE_PROJECTS.get(req.project_id) if req.project_id else None
    scene_texts = []
    scene_ids = []

    if req.scenes and len(req.scenes) > 0:
        for sc in req.scenes:
            txt = sc.get("text") or sc.get("narration_text") or ""
            scene_texts.append(txt)
            scene_ids.append(sc.get("scene_id", len(scene_ids) + 1))
    elif project and project.scenes:
        for sc in project.scenes:
            scene_texts.append(sc.narration_text or "")
            scene_ids.append(sc.scene_id)

    non_empty_texts = [t for t in scene_texts if t.strip()]

    try:
        if non_empty_texts:
            system_logger.info("ALIGN", f"Initiating speech alignment for {len(scene_texts)} scenes (Audio: {Path(audio_path).name})")
            total_duration, intervals, scene_words = align_custom_audio(str(audio_path), scene_texts)
            detected_texts = scene_texts
        else:
            target_count = req.num_visual_clips or (len(scene_texts) if scene_texts else None)
            system_logger.info("ALIGN", f"Initiating auto-segmentation for audio: {Path(audio_path).name} (target cuts: {target_count})")
            total_duration, intervals, scene_words, detected_texts = auto_segment_audio(str(audio_path), target_segments=target_count)

        system_logger.success("ALIGN", f"Speech alignment successful: {len(intervals)} scene boundaries calculated ({total_duration:.2f}s)")
    except Exception as e:
        system_logger.error("API", f"Custom audio speech alignment failed: {e}")
        raise HTTPException(status_code=500, detail=f"Speech alignment failed: {str(e)}")

    aligned_scenes = []
    for idx, (st, en) in enumerate(intervals):
        sc_id = scene_ids[idx] if idx < len(scene_ids) else idx + 1
        dur = round(en - st, 3)
        words = scene_words[idx] if idx < len(scene_words) else []
        txt = detected_texts[idx] if idx < len(detected_texts) else ""
        aligned_scenes.append({
            "scene_id": sc_id,
            "text": txt,
            "timeline_start": st,
            "timeline_end": en,
            "audio_duration": dur,
            "word_timestamps": words
        })

    # Update active project in memory if present
    if project:
        for sc_data in aligned_scenes:
            target = next((s for s in project.scenes if s.scene_id == sc_data["scene_id"]), None)
            if target:
                target.timeline_start = sc_data["timeline_start"]
                target.timeline_end = sc_data["timeline_end"]
                target.audio_duration = sc_data["audio_duration"]
                target.word_timestamps = sc_data["word_timestamps"]
                target.local_audio_path = str(audio_path)
        project.total_timeline_duration = total_duration

    return {
        "success": True,
        "total_duration": total_duration,
        "aligned_scenes": aligned_scenes
    }


CANCELLED_PROJECT_RENDERS = set()
ACTIVE_RENDER_POPS: Dict[str, Any] = {}

def _render_background_task(
    project_id: str,
    include_sub: bool,
    include_tick: bool,
    include_mus: bool,
    default_trans: str = "fade",
    trans_dur: float = 0.5,
    max_shot_dur: Optional[float] = None,
    custom_soundbed_path: Optional[str] = None,
    soundbed_volume: Optional[float] = None
):
    """Background rendering worker using unified single-timeline engine."""
    CANCELLED_PROJECT_RENDERS.discard(project_id)
    project = ACTIVE_PROJECTS.get(project_id)
    if not project:
        return

    pipeline = NewsVideoPipeline()
    project.include_subtitles = include_sub
    project.include_ticker = include_tick
    project.include_background_music = include_mus
    project.default_transition = default_trans
    project.transition_duration = trans_dur
    if max_shot_dur is not None and max_shot_dur > 0:
        project.max_shot_duration = max_shot_dur
    elif not getattr(project, "max_shot_duration", None):
        project.max_shot_duration = MAX_SCENE_INTERVAL

    if custom_soundbed_path:
        project.soundbed_path = custom_soundbed_path
    if soundbed_volume is not None:
        project.soundbed_volume = soundbed_volume

    def on_progress(p: int):
        project.progress_percent = p
        system_logger.info("RENDER", f"Rendering progress: {p}% complete (Project: {project_id})")

    try:
        system_logger.info("RENDER", f"Executing single-pass video render for project {project_id}")
        output_path = pipeline.render_project_video(
            project,
            progress_callback=on_progress,
            cancel_checker=lambda: project_id in CANCELLED_PROJECT_RENDERS,
            register_process=lambda p: ACTIVE_RENDER_POPS.__setitem__(project_id, p)
        )
        # Convert path to accessible web URL
        rel_path = Path(output_path).relative_to(STORAGE_DIR).as_posix()
        project.output_video_path = f"/storage/{rel_path}"
        project.status = "completed"
        project.progress_percent = 100
        system_logger.success("RENDER", f"Project {project_id} successfully exported -> {project.output_video_path}")
    except Exception as e:
        if project_id in CANCELLED_PROJECT_RENDERS or "cancelled" in str(e).lower():
            project.status = "cancelled"
            project.error_message = "Export cancelled by user"
            system_logger.warning("RENDER", f"Project {project_id} render was cancelled.")
        else:
            system_logger.error("RENDER", f"Render failure for project {project_id}: {str(e)}")
            print(f"[RenderTask] Error rendering project {project_id}: {e}")
            project.status = "failed"
            project.error_message = str(e)[:500]
    finally:
        ACTIVE_RENDER_POPS.pop(project_id, None)
        CANCELLED_PROJECT_RENDERS.discard(project_id)


def resolve_storage_path(p: Optional[str]) -> Optional[str]:
    if not p:
        return None
    p_clean = str(p).strip().replace("\\", "/")
    if "/storage/" in p_clean:
        rel = p_clean.split("/storage/", 1)[1]
        local = STORAGE_DIR / rel
        if local.exists():
            return str(local)
    elif p_clean.startswith("storage/"):
        local = STORAGE_DIR / p_clean[len("storage/"):]
        if local.exists():
            return str(local)
    # Search by filename in media directories
    fname = Path(p_clean).name
    for base in [MEDIA_DIR, STORAGE_DIR, MUSIC_DIR]:
        cand = base / fname
        if cand.exists():
            return str(cand)
    p_native = str(Path(p))
    if os.path.exists(p_native):
        return p_native
    return p

def ensure_local_media_path(path_or_url: Optional[str]) -> Optional[str]:
    if not path_or_url:
        return None
    local = resolve_storage_path(path_or_url)
    if local and os.path.exists(local):
        return local
    # If it is an external web URL, download and cache it locally
    str_url = str(path_or_url)
    if str_url.startswith("http://") or str_url.startswith("https://"):
        try:
            import hashlib, urllib.request
            h = hashlib.md5(str_url.encode("utf-8")).hexdigest()[:12]
            dest = MEDIA_DIR / f"web_{h}.jpg"
            if dest.exists() and dest.stat().st_size > 1000:
                return str(dest)
            urllib.request.urlretrieve(str_url, str(dest))
            if dest.exists() and dest.stat().st_size > 1000:
                return str(dest)
        except Exception as e:
            system_logger.warning("RENDER", f"Could not download external image {path_or_url}: {e}")
    return local


class UploadMediaRequest(BaseModel):
    filename: str
    data: str

@app.post("/api/upload-media")
async def upload_media(req: UploadMediaRequest):
    """Uploads user media via standard JSON base64 (zero external dependencies)."""
    import base64
    ext = Path(req.filename or "").suffix or ".jpg"
    safe_stem = re.sub(r'[^\w\-_\.]', '_', Path(req.filename or "").stem)[:30] or "media"
    unique_name = f"user_{int(time.time())}_{safe_stem}{ext}"
    dest_path = MEDIA_DIR / unique_name
    raw = req.data
    if "," in raw:
        raw = raw.split(",", 1)[1]
    with open(dest_path, "wb") as f:
        f.write(base64.b64decode(raw))
    rel_path = f"/storage/media/{unique_name}"
    return {
        "success": True,
        "filename": unique_name,
        "url": rel_path,
        "local_path": str(dest_path)
    }


@app.post("/api/render-project")
async def render_project(req: RenderProjectRequest, background_tasks: BackgroundTasks):
    """Initiates full broadcast video rendering in background."""
    project = ACTIVE_PROJECTS.get(req.project_id)
    if not project:
        # Create dynamic timeline project so export works even without an AI script
        project = VideoProject(
            project_id=req.project_id,
            title="Custom Timeline Video",
            raw_script="",
            category="custom",
            theme="breaking_news",
            aspect_ratio="16:9",
            voice="en-US-GuyNeural",
            scenes=[]
        )
        ACTIVE_PROJECTS[req.project_id] = project

    # Sync fresh scenes from timeline if provided by frontend
    if req.scenes and len(req.scenes) > 0:
        new_scenes = []
        for idx, sc_dict in enumerate(req.scenes):
            raw_media = sc_dict.get("local_media_path") or sc_dict.get("src") or ""
            m_path = ensure_local_media_path(raw_media)
            a_path = resolve_storage_path(sc_dict.get("local_audio_path"))

            raw_all = sc_dict.get("all_media_paths") or []
            all_paths = [ensure_local_media_path(p) for p in raw_all if p]
            if not all_paths and m_path:
                all_paths = [m_path]

            sc = SceneData(
                scene_id=sc_dict.get("scene_id", idx + 1),
                search_query=sc_dict.get("search_query", ""),
                narration_text=sc_dict.get("narration_text", ""),
                lower_third_headline=sc_dict.get("lower_third_headline", ""),
                category_tag=sc_dict.get("category_tag", "NEWS"),
                motion_style=sc_dict.get("motion_style", "zoom_in"),
                transition_type=sc_dict.get("transition_type", req.default_transition),
                transition_duration=sc_dict.get("transition_duration", req.transition_duration),
                timeline_start=float(sc_dict.get("timeline_start", 0.0)),
                timeline_end=float(sc_dict.get("timeline_end", 5.0)),
                local_media_path=m_path if m_path else None,
                all_media_paths=[p for p in all_paths if p],
                local_audio_path=a_path if a_path else None,
                audio_offset=float(sc_dict.get("audio_offset", 0.0)),
                audio_volume=float(sc_dict.get("audio_volume", 1.0))
            )
            new_scenes.append(sc)
        project.scenes = new_scenes
        project.total_timeline_duration = max((s.timeline_end for s in new_scenes), default=10.0)
        # Only clear stale master audio if fresh scenes provide their own audio
        has_scene_audio = any(s.local_audio_path for s in new_scenes)
        if has_scene_audio or not project.master_audio_path or not os.path.exists(project.master_audio_path):
            project.master_audio_path = None

    # Handle custom soundbed / background music
    resolved_bed = resolve_storage_path(req.custom_soundbed_path)
    project.soundbed_path = resolved_bed if resolved_bed and os.path.exists(resolved_bed) else None
    project.soundbed_volume = req.soundbed_volume

    system_logger.info(
        "API",
        f"POST /api/render-project: project_id={req.project_id}, subtitles={req.include_subtitles}, "
        f"transition={req.default_transition} ({req.transition_duration}s), scenes_count={len(project.scenes)}"
    )

    # Reset any previous output video and status so poll gets fresh progress
    project.output_video_path = None
    project.error_message = None
    project.status = "rendering"
    project.progress_percent = 5
    project.default_transition = req.default_transition
    project.transition_duration = req.transition_duration
    if req.max_shot_duration is not None and req.max_shot_duration > 0:
        project.max_shot_duration = req.max_shot_duration

    background_tasks.add_task(
        _render_background_task,
        req.project_id,
        req.include_subtitles,
        req.include_ticker,
        req.include_music,
        req.default_transition,
        req.transition_duration,
        req.max_shot_duration,
        resolved_bed,
        req.soundbed_volume
    )

    return {
        "success": True,
        "message": "Rendering job started.",
        "project_id": req.project_id
    }


@app.get("/api/project-status/{project_id}")
async def get_project_status(project_id: str):
    """Returns real-time rendering status and output video URL."""
    project = ACTIVE_PROJECTS.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    return {
        "project_id": project.project_id,
        "status": project.status,
        "progress_percent": project.progress_percent,
        "output_video_path": project.output_video_path,
        "error_message": project.error_message,
        "scenes": [s.model_dump() for s in project.scenes]
    }


@app.post("/api/cancel-render/{project_id}")
async def cancel_render(project_id: str):
    """Cancels an in-progress video rendering job."""
    CANCELLED_PROJECT_RENDERS.add(project_id)
    project = ACTIVE_PROJECTS.get(project_id)
    if project:
        project.status = "cancelled"
        project.error_message = "Export cancelled by user"
    proc = ACTIVE_RENDER_POPS.get(project_id)
    if proc:
        try:
            proc.kill()
        except Exception:
            pass
        ACTIVE_RENDER_POPS.pop(project_id, None)
    system_logger.warning("RENDER", f"Render job cancelled by user for project {project_id}")
    return {"success": True, "message": "Render cancelled"}


# ==============================================================================
# SYSTEM LOGS & DIAGNOSTICS APIS
# ==============================================================================
@app.get("/api/system-logs")
async def get_system_logs(
    since_id: int = 0,
    limit: int = 250,
    level: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None
):
    """Returns real-time engine activity and system logs."""
    return system_logger.get_logs(
        since_id=since_id,
        limit=limit,
        level=level,
        source=source,
        query=q
    )


@app.get("/api/system-logs/stream")
async def stream_system_logs(request: Request, since_id: int = 0):
    """Server-Sent Events (SSE) real-time streaming endpoint for system logs."""
    async def event_generator():
        curr_id = since_id
        while True:
            if await request.is_disconnected():
                break
            res = system_logger.get_logs(since_id=curr_id, limit=50)
            logs = res.get("logs", [])
            if logs:
                curr_id = res.get("latest_id", curr_id)
                for rec in logs:
                    yield f"data: {json.dumps(rec)}\n\n"
            await asyncio.sleep(0.35)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/system-logs")
async def record_client_log(req: ClientLogRequest):
    """Allows frontend UI to push client-side interaction logs into central store."""
    rec = system_logger.log(
        level=req.level,
        source=req.source,
        message=req.message,
        details=req.details
    )
    return {"success": True, "log": rec.to_dict()}


@app.post("/api/system-logs/clear")
async def clear_system_logs():
    """Clears the system log stream."""
    system_logger.clear()
    system_logger.info("SYSTEM", "Logs cleared by user action")
    return {"success": True, "message": "System logs reset"}


@app.get("/api/system-logs/export")
async def export_system_logs():
    """Downloads plain text log file."""
    from fastapi.responses import Response
    text = system_logger.export_text()
    return Response(
        content=text,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="system_engine_logs.txt"'}
    )



# Static Frontend Files
STATIC_DIR = BASE_DIR / "web_studio" / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static_ui")

@app.get("/")
async def serve_studio_ui():
    """Serves the main Web Studio HTML interface."""
    index_html = BASE_DIR / "web_studio" / "index.html"
    return FileResponse(str(index_html))

if __name__ == "__main__":
    import uvicorn
    print("=== Launching AI News-Video Generator Studio on http://localhost:8000 ===")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)

