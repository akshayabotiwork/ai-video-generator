import { useProjectStore } from "../stores/project-store";
import { toast } from "../stores/notification-store";
import { getTransitionBridge } from "../bridges/transition-bridge";
import type { TransitionType, Transition, Keyframe, Clip, Track } from "@openreel/core";
import type { VideoEffectType } from "../bridges/effects-bridge";

export const VALID_OPENREEL_TRANSITIONS: readonly TransitionType[] = [
  "crossfade",
  "dipToBlack",
  "dipToWhite",
  "wipe",
  "slide",
  "zoom",
  "push",
  "circleReveal",
  "blur",
  "whipPan",
  "radialWipe",
  "pixelate",
  "glitch",
  "blinds",
  "diamondReveal",
  "spin",
  "flip",
  "splitReveal",
  "flash",
  "filmBurn",
  "mosaic",
  "ripple",
  "pageTurn",
  "colorSplit",
];

export type OpenReelTransitionType =
  | TransitionType
  | "dissolve"
  | "fade"
  | "iris";

export type OpenReelLayerEffectType =
  | "blur"
  | "shadow"
  | "glow"
  | "brightness"
  | "contrast"
  | "saturation"
  | "hue-saturation"
  | "color-balance"
  | "curves"
  | "motion-blur"
  | "radial-blur"
  | "vignette"
  | "grain"
  | "film-grain"
  | "chromatic-aberration"
  | "sharpen";

/**
 * Normalizes any transition name to a verified OpenReel TransitionType
 */
export function normalizeTransitionType(raw?: string): TransitionType {
  if (!raw) return "crossfade";
  const lower = raw.toLowerCase().trim().replace(/[-_]/g, "");
  if (lower === "dissolve" || lower === "fade" || lower === "crossfade") return "crossfade";
  if (lower === "diptoblack") return "dipToBlack";
  if (lower === "diptowhite") return "dipToWhite";
  if (lower === "iris" || lower === "circlereveal") return "circleReveal";
  if (lower === "diamond" || lower === "diamondreveal") return "diamondReveal";
  if (lower === "split" || lower === "splitreveal") return "splitReveal";
  if (lower === "whippan") return "whipPan";
  if (lower === "radialwipe") return "radialWipe";
  if (lower === "filmburn") return "filmBurn";
  if (lower === "pageturn") return "pageTurn";
  if (lower === "colorsplit") return "colorSplit";
  const match = VALID_OPENREEL_TRANSITIONS.find((t) => t.toLowerCase() === lower);
  return match || "crossfade";
}

/**
 * Generates smooth Ken Burns animated keyframes for a clip
 */
export function createKenBurnsKeyframes(
  clipId: string,
  motionStyle: string,
  clipDuration: number
): Keyframe[] {
  const kfs: Keyframe[] = [];
  const style = motionStyle?.toLowerCase().trim() || "zoom_in";
  const dur = Math.max(0.5, clipDuration);

  if (style === "zoom_out") {
    kfs.push(
      {
        id: `kf-${clipId}-sx-0`,
        time: 0,
        property: "scale.x",
        value: 1.18,
        easing: "ease-in-out",
      },
      {
        id: `kf-${clipId}-sy-0`,
        time: 0,
        property: "scale.y",
        value: 1.18,
        easing: "ease-in-out",
      },
      {
        id: `kf-${clipId}-sx-1`,
        time: dur,
        property: "scale.x",
        value: 1.0,
        easing: "ease-in-out",
      },
      {
        id: `kf-${clipId}-sy-1`,
        time: dur,
        property: "scale.y",
        value: 1.0,
        easing: "ease-in-out",
      }
    );
  } else if (style === "pan_left") {
    kfs.push(
      {
        id: `kf-${clipId}-sx-0`,
        time: 0,
        property: "scale.x",
        value: 1.12,
        easing: "linear",
      },
      {
        id: `kf-${clipId}-sy-0`,
        time: 0,
        property: "scale.y",
        value: 1.12,
        easing: "linear",
      },
      {
        id: `kf-${clipId}-px-0`,
        time: 0,
        property: "position.x",
        value: 35,
        easing: "ease-in-out",
      },
      {
        id: `kf-${clipId}-px-1`,
        time: dur,
        property: "position.x",
        value: -35,
        easing: "ease-in-out",
      }
    );
  } else if (style === "pan_right") {
    kfs.push(
      {
        id: `kf-${clipId}-sx-0`,
        time: 0,
        property: "scale.x",
        value: 1.12,
        easing: "linear",
      },
      {
        id: `kf-${clipId}-sy-0`,
        time: 0,
        property: "scale.y",
        value: 1.12,
        easing: "linear",
      },
      {
        id: `kf-${clipId}-px-0`,
        time: 0,
        property: "position.x",
        value: -35,
        easing: "ease-in-out",
      },
      {
        id: `kf-${clipId}-px-1`,
        time: dur,
        property: "position.x",
        value: 35,
        easing: "ease-in-out",
      }
    );
  } else {
    // Default zoom_in
    kfs.push(
      {
        id: `kf-${clipId}-sx-0`,
        time: 0,
        property: "scale.x",
        value: 1.0,
        easing: "ease-in-out",
      },
      {
        id: `kf-${clipId}-sy-0`,
        time: 0,
        property: "scale.y",
        value: 1.0,
        easing: "ease-in-out",
      },
      {
        id: `kf-${clipId}-sx-1`,
        time: dur,
        property: "scale.x",
        value: 1.18,
        easing: "ease-in-out",
      },
      {
        id: `kf-${clipId}-sy-1`,
        time: dur,
        property: "scale.y",
        value: 1.18,
        easing: "ease-in-out",
      }
    );
  }
  return kfs;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface AIProjectScene {
  scene_id: number;
  narration_text: string;
  lower_third_headline?: string;
  category_tag?: string;
  motion_style?: "zoom_in" | "zoom_out" | "pan_left" | "pan_right" | "static" | string;
  motion_speed?: string;
  transition_type?: OpenReelTransitionType;
  transition_direction?: string;
  transition_duration?: number;
  layer_effects?: OpenReelLayerEffectType[];
  timeline_start: number;
  timeline_end: number;
  word_timestamps?: WordTimestamp[];
  local_media_path?: string;
  all_media_paths?: string[];
  local_audio_path?: string;
  audio_duration?: number;
  selected_visual?: {
    image_url?: string;
    thumbnail_url?: string;
    title?: string;
  };
  visual_candidates?: Array<{
    image_url: string;
    thumbnail_url: string;
    title: string;
  }>;
}

export interface AIParsedProject {
  project_id: string;
  title: string;
  category: string;
  theme: string;
  aspect_ratio: "16:9" | "9:16" | "1:1";
  voice: string;
  max_shot_duration?: number;
  total_timeline_duration?: number;
  master_audio_path?: string;
  soundbed_path?: string;
  soundbed_volume?: number;
  include_subtitles?: boolean;
  scenes: AIProjectScene[];
}

export interface GenerateProjectParams {
  script_text: string;
  category?: string;
  project_title?: string;
  theme?: string;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  voice?: string;
  max_shot_duration?: number;
  include_subtitles?: boolean;
  include_soundbed?: boolean;
  serp_api_key?: string;
  openai_key?: string;
  gemini_key?: string;
}

/**
 * Normalizes backend local file path to accessible /storage URL
 */
export function toStorageUrl(rawPath?: string): string {
  if (!rawPath) return "";
  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    return rawPath;
  }
  const clean = rawPath.replace(/\\/g, "/");
  const storageIndex = clean.indexOf("storage/");
  if (storageIndex !== -1) {
    return "/" + clean.slice(storageIndex);
  }
  return `/storage/${clean.replace(/^\//, "")}`;
}

/**
 * Maps AI backend effect names to OpenReel VideoEffectType and active parameters
 */
export function mapEffectToOpenReel(
  effName: string
): { type: VideoEffectType; params: Record<string, unknown> } | null {
  const norm = effName.toLowerCase().trim().replace(/_/g, "-");
  if (norm === "vignette") {
    return {
      type: "vignette",
      params: { amount: 0.6, midpoint: 0.5, roundness: 0.5, feather: 0.4 },
    };
  }
  if (norm === "film-grain" || norm === "grain") {
    return {
      type: "grain",
      params: { amount: 0.4, size: 1.2, roughness: 0.6, colored: false },
    };
  }
  if (norm === "motion-blur") {
    return {
      type: "motion-blur",
      params: { angle: 0, distance: 25 },
    };
  }
  if (norm === "radial-blur") {
    return {
      type: "radial-blur",
      params: { centerX: 0.5, centerY: 0.5, strength: 0.3 },
    };
  }
  if (norm === "glow") {
    return {
      type: "glow",
      params: { radius: 15, intensity: 1.2, color: "#ffffff" },
    };
  }
  if (norm === "chromatic-aberration") {
    return {
      type: "chromatic-aberration",
      params: { amount: 15 },
    };
  }
  if (norm === "blur") {
    return {
      type: "blur",
      params: { radius: 10, type: "gaussian" },
    };
  }
  if (norm === "contrast") {
    return {
      type: "contrast",
      params: { value: 1.35 },
    };
  }
  if (norm === "brightness") {
    return {
      type: "brightness",
      params: { value: 15 },
    };
  }
  if (norm === "saturation") {
    return {
      type: "saturation",
      params: { value: 1.3 },
    };
  }
  if (norm === "sharpen") {
    return {
      type: "sharpen",
      params: { amount: 0.5, radius: 1, threshold: 0 },
    };
  }
  return null;
}

/**
 * Helper to fetch a URL as a browser File object for OpenReel ingestion
 */
async function fetchAsFile(url: string, fallbackName: string, defaultMime: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[AI Studio] Failed to fetch media from ${url}: ${res.statusText}`);
      return null;
    }
    const blob = await res.blob();
    const mime = blob.type || defaultMime;
    return new File([blob], fallbackName, { type: mime });
  } catch (err) {
    console.error(`[AI Studio] Error loading file from ${url}:`, err);
    return null;
  }
}

/**
 * Helper to calculate sub-shot durations based on max_shot_duration
 */
function calculateSubShotDurations(totalDuration: number, maxShotDur: number): number[] {
  if (totalDuration <= maxShotDur) {
    return [totalDuration];
  }
  const threshold = maxShotDur * 0.5;
  const fullShots = Math.floor(totalDuration / maxShotDur);
  const remainder = Math.round((totalDuration - fullShots * maxShotDur) * 1000) / 1000;

  if (remainder >= threshold) {
    return Array(fullShots).fill(maxShotDur).concat([remainder]);
  } else if (fullShots > 1) {
    return Array(fullShots - 1)
      .fill(maxShotDur)
      .concat([Math.round((maxShotDur + remainder) * 1000) / 1000]);
  } else {
    return [totalDuration];
  }
}

/**
 * Calls FastAPI backend to parse script, generate voiceover and fetch visuals,
 * then maps and mounts everything directly onto OpenReel's multi-track timeline!
 */
export async function generateAndLoadAIStory(
  params: GenerateProjectParams,
  onProgress?: (status: string) => void
): Promise<{ success: boolean; project?: AIParsedProject; error?: string }> {
  try {
    onProgress?.("Contacting AI Director (Segmenting script, selecting OpenReel effects & pacing)...");

    const response = await fetch("/api/parse-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script_text: params.script_text,
        category: params.category || "general",
        project_title: params.project_title || "AI Generated Video",
        theme: params.theme || "breaking_news",
        aspect_ratio: params.aspect_ratio || "16:9",
        voice: params.voice || "en-US-GuyNeural",
        max_shot_duration: params.max_shot_duration || 3.0,
        serp_api_key: params.serp_api_key,
        openai_key: params.openai_key,
        gemini_key: params.gemini_key,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Backend error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data.success || !data.project) {
      throw new Error(data.detail || "Script parsing failed on server");
    }

    const aiProject: AIParsedProject = data.project;
    const scenes = aiProject.scenes || [];

    if (scenes.length === 0) {
      throw new Error("No scenes generated for this script");
    }

    onProgress?.(`Generated ${scenes.length} scenes. Initializing OpenReel timeline tracks...`);

    const projectStore = useProjectStore.getState();

    // 1. Set Project Name & Settings
    if (aiProject.title) {
      void projectStore.renameProject(aiProject.title);
    }

    // Set Aspect Ratio (16:9 = 1920x1080, 9:16 = 1080x1920, 1:1 = 1080x1080)
    let width = 1920;
    let height = 1080;
    if (aiProject.aspect_ratio === "9:16") {
      width = 1080;
      height = 1920;
    } else if (aiProject.aspect_ratio === "1:1") {
      width = 1080;
      height = 1080;
    }

    await projectStore.updateSettings({
      width,
      height,
    });

    // 2. Identify or Create Visual, Audio, Headlines, Subtitles, and Music Tracks
    const currentTracks = projectStore.project.timeline.tracks;
    let videoTrack = currentTracks.find((t) => t.type === "video" && !t.locked && t.role !== "captions");
    let audioTrack = currentTracks.find((t) => t.type === "audio" && !t.locked && t.name?.includes("Voiceover"));
    if (!audioTrack) {
      audioTrack = currentTracks.find((t) => t.type === "audio" && !t.locked);
    }
    let headlinesTrack = currentTracks.find((t) => t.name === "Headlines" || (t.type === "video" && t.role === "captions"));
    let subtitlesTrack = currentTracks.find((t) => t.name === "Subtitles");
    let musicTrack = currentTracks.find((t) => t.type === "audio" && t.name?.toLowerCase().includes("music"));

    if (!videoTrack) {
      const res = await projectStore.addTrack("video", 0, { name: "Visuals Track" });
      if (res?.success) {
        videoTrack = useProjectStore.getState().project.timeline.tracks.find((t) => t.name === "Visuals Track");
      }
    }

    if (!audioTrack) {
      const res = await projectStore.addTrack("audio", undefined, { name: "Voiceover Track" });
      if (res?.success) {
        audioTrack = useProjectStore.getState().project.timeline.tracks.find((t) => t.name === "Voiceover Track");
      }
    }

    if (!headlinesTrack) {
      const res = await projectStore.addTrack("video", 0, { name: "Headlines", role: "captions" });
      if (res?.success) {
        headlinesTrack = useProjectStore.getState().project.timeline.tracks.find((t) => t.name === "Headlines");
      }
    }

    if (params.include_subtitles !== false && !subtitlesTrack) {
      const res = await projectStore.addTrack("video", 0, { name: "Subtitles", role: "captions" });
      if (res?.success) {
        subtitlesTrack = useProjectStore.getState().project.timeline.tracks.find((t) => t.name === "Subtitles");
      }
    }

    const vTrackId = videoTrack?.id || useProjectStore.getState().project.timeline.tracks[0]?.id;
    const aTrackId = audioTrack?.id || useProjectStore.getState().project.timeline.tracks.find((t) => t.type === "audio")?.id;
    const hTrackId = headlinesTrack?.id;
    const sTrackId = subtitlesTrack?.id;

    // Ingest Master Voiceover Audio Track (Single continuous master voiceover track)
    const masterVoPath =
      aiProject.master_audio_path ||
      (scenes.length > 0 &&
      scenes.every(
        (s) => s.local_audio_path && s.local_audio_path === scenes[0]?.local_audio_path,
      )
        ? scenes[0]?.local_audio_path
        : null);

    if (masterVoPath && aTrackId) {
      onProgress?.("Importing continuous master voiceover track...");
      const audioUrl = toStorageUrl(masterVoPath);
      const file = await fetchAsFile(audioUrl, "master_voiceover.mp3", "audio/mpeg");
      if (file) {
        const importRes = await projectStore.importMedia(file);
        if (importRes.success) {
          const mediaId =
            (importRes as any)?.actionId ||
            useProjectStore
              .getState()
              .project.mediaLibrary.items.find((m) => m.name === file.name)?.id;
          if (mediaId) {
            await projectStore.addClip(aTrackId, mediaId, 0);
          }
        }
      }
    }

    // 3. Gapless Contiguous Timeline Ingestion with Multi-Shot Subdivisions
    const maxShotDur = Math.max(1.5, params.max_shot_duration || aiProject.max_shot_duration || 3.0);
    const addedVisualClips: Array<{ clipId: string; sceneIndex: number; shotIndex: number; startTime: number; duration: number }> = [];

    let currentVisualPos = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      onProgress?.(`Processing Scene ${i + 1}/${scenes.length}: ${scene.lower_third_headline || "Visuals"}`);

      // Strict gapless contiguous timing on primary visual track for seamless cuts and transitions
      const sceneStart = currentVisualPos;
      const rawDur = scene.audio_duration || (scene.timeline_end && scene.timeline_end > scene.timeline_start ? scene.timeline_end - scene.timeline_start : 3.0);
      const sceneDuration = Math.round(Math.max(rawDur, 1.0) * 1000) / 1000;
      const sceneEnd = Math.round((sceneStart + sceneDuration) * 1000) / 1000;
      currentVisualPos = sceneEnd;

      // Collect available candidate images for this scene
      const candidateUrls: string[] = [];
      if (scene.all_media_paths && scene.all_media_paths.length > 0) {
        scene.all_media_paths.forEach((p) => {
          const u = toStorageUrl(p);
          if (u && !candidateUrls.includes(u)) candidateUrls.push(u);
        });
      }
      if (scene.local_media_path) {
        const u = toStorageUrl(scene.local_media_path);
        if (u && !candidateUrls.includes(u)) candidateUrls.unshift(u);
      }
      if (scene.selected_visual?.image_url) {
        const u = toStorageUrl(scene.selected_visual.image_url);
        if (u && !candidateUrls.includes(u)) candidateUrls.push(u);
      }
      if (candidateUrls.length === 0) {
        candidateUrls.push("https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1280&q=80");
      }

      // Subdivide long scenes into multiple shots for dynamic pacing
      const shotDurations = calculateSubShotDurations(sceneDuration, maxShotDur);
      const numSubShots = shotDurations.length;

      let curSubStart = sceneStart;
      for (let k = 0; k < numSubShots; k++) {
        const subDur = shotDurations[k];
        const subStart = Math.round(curSubStart * 1000) / 1000;
        const subEnd = (k === numSubShots - 1) ? sceneEnd : Math.round((subStart + subDur) * 1000) / 1000;
        curSubStart = subEnd;
        const subDuration = Math.round((subEnd - subStart) * 1000) / 1000;

        const subImageUrl = candidateUrls[k % candidateUrls.length];
        if (subImageUrl && vTrackId) {
          const ext = subImageUrl.toLowerCase().endsWith(".mp4") ? "mp4" : "jpg";
          const mime = ext === "mp4" ? "video/mp4" : "image/jpeg";
          const file = await fetchAsFile(subImageUrl, `scene_${scene.scene_id}_shot_${k + 1}.${ext}`, mime);

          if (file) {
            const importRes = await projectStore.importMedia(file);
            if (importRes.success) {
              const mediaId = (importRes as any)?.actionId || useProjectStore
                .getState()
                .project.mediaLibrary.items.find((m) => m.name === file.name)?.id;

              if (mediaId) {
                // Snapshot existing clip IDs on this track before adding to guarantee finding newly added clip
                const preExistingClipIds = new Set(
                  useProjectStore.getState().project.timeline.tracks.find((t) => t.id === vTrackId)?.clips.map((c) => c.id) || []
                );

                const addRes = await projectStore.addClip(vTrackId, mediaId, subStart);
                if (addRes.success) {
                  // Find the exact newly added clip
                  const trackClips =
                    useProjectStore.getState().project.timeline.tracks.find((t) => t.id === vTrackId)?.clips || [];
                  const newlyAddedClip = trackClips.find((c) => !preExistingClipIds.has(c.id));
                  const actualClipId = newlyAddedClip?.id;

                  if (actualClipId) {
                    // 1. Trim clip to exact subDuration so adjacent clips have 0 gap
                    await projectStore.trimClip(actualClipId, 0, subDuration);

                    addedVisualClips.push({
                      clipId: actualClipId,
                      sceneIndex: i,
                      shotIndex: k,
                      startTime: subStart,
                      duration: subDuration,
                    });

                    // 2. Apply Real Animated Ken Burns Keyframes (scale and position over time)
                    const motionStyle = scene.motion_style || "zoom_in";
                    const keyframes = createKenBurnsKeyframes(actualClipId, motionStyle, subDuration);
                    projectStore.updateClipKeyframes(actualClipId, keyframes);

                    // Also set base transform
                    await projectStore.updateClipTransform(actualClipId, {
                      scale: { x: 1.0, y: 1.0 },
                      position: { x: 0, y: 0 },
                    });

                    // 3. Apply OpenReel Layer Effects (e.g. Vignette, Film Grain, Motion Blur)
                    if (scene.layer_effects && scene.layer_effects.length > 0) {
                      for (const rawEff of scene.layer_effects) {
                        const effDef = mapEffectToOpenReel(rawEff);
                        if (effDef) {
                          await projectStore.addVideoEffect(actualClipId, effDef.type, effDef.params);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Ingest TTS Voiceover Audio on Audio Track
      const audioUrl = toStorageUrl(scene.local_audio_path);
      if (audioUrl && aTrackId) {
        const file = await fetchAsFile(audioUrl, `scene_${scene.scene_id}_vo.mp3`, "audio/mpeg");
        if (file) {
          const importRes = await projectStore.importMedia(file);
          if (importRes.success) {
            const mediaItem = useProjectStore
              .getState()
              .project.mediaLibrary.items.find((m) => m.name === file.name);
            const mediaId = mediaItem?.id;
            if (mediaId) {
              await projectStore.addClip(aTrackId, mediaId, sceneStart);
            }
          }
        }
      }

      // Ingest Lower-Third Headline on Headlines Track (positioned at bottom y = 0.88, no background box)
      const headline = scene.lower_third_headline || scene.narration_text?.slice(0, 50);
      if (headline && hTrackId && projectStore.createTextClip) {
        const headlineClip = projectStore.createTextClip(
          hTrackId,
          sceneStart,
          headline,
          sceneDuration,
          {
            fontFamily: "Inter, sans-serif",
            fontSize: 30,
            fontWeight: "bold",
            color: "#ffffff",
            strokeColor: "#000000",
            strokeWidth: 3,
            textAlign: "center",
          }
        );
        if (headlineClip && projectStore.updateTextTransform) {
          projectStore.updateTextTransform(headlineClip.id, {
            position: { x: 0.5, y: 0.88 },
          });
        }
      }

      // Ingest Word-Synced Captions (positioned above headline at y = 0.78, no background box)
      if (scene.word_timestamps && scene.word_timestamps.length > 0 && sTrackId && projectStore.createTextClip) {
        // Group words into 3-4 word readable subtitle chunks
        const words = scene.word_timestamps;
        for (let w = 0; w < words.length; w += 4) {
          const chunk = words.slice(w, w + 4);
          const chunkText = chunk.map((c) => c.word).join(" ");
          const chunkStart = sceneStart + (chunk[0]?.start || 0);
          const chunkEnd = sceneStart + (chunk[chunk.length - 1]?.end || chunkStart + 1.2);
          const chunkDur = Math.max(0.5, chunkEnd - chunkStart);

          const captionClip = projectStore.createTextClip(
            sTrackId,
            chunkStart,
            chunkText,
            chunkDur,
            {
              fontFamily: "Inter, sans-serif",
              fontSize: 38,
              fontWeight: "bold",
              color: "#fbbf24", // Vibrant amber/gold accent
              strokeColor: "#000000",
              strokeWidth: 3,
              textAlign: "center",
            }
          );
          if (captionClip && projectStore.updateTextTransform) {
            projectStore.updateTextTransform(captionClip.id, {
              position: { x: 0.5, y: headline ? 0.78 : 0.84 },
            });
          }
        }
      }
    }

    // 4. Inject Native OpenReel Transitions between adjacent visual clips
    if (addedVisualClips.length > 1 && projectStore.addClipTransition) {
      onProgress?.("Applying OpenReel transitions across storyboard cuts...");
      const bridge = getTransitionBridge();
      if (!bridge.isInitialized()) {
        try {
          bridge.initialize(width, height);
        } catch (e) {
          console.warn("[AI Studio] Transition bridge init notice:", e);
        }
      }

      for (let c = 0; c < addedVisualClips.length - 1; c++) {
        const clipAInfo = addedVisualClips[c];
        const clipBInfo = addedVisualClips[c + 1];
        const scene = scenes[clipAInfo.sceneIndex];
        const rawTransType = scene?.transition_type || "crossfade";
        const transType = normalizeTransitionType(rawTransType);
        const transDir = scene?.transition_direction || "left";

        const clipA = useProjectStore.getState().getClip(clipAInfo.clipId);
        const clipB = useProjectStore.getState().getClip(clipBInfo.clipId);

        if (clipA && clipB) {
          // Center-on-cut transition window: duration cannot exceed min visible duration of either clip
          const maxAllowed = Math.min(clipA.duration, clipB.duration) * 0.5;
          const transDur = Math.max(0.2, Math.min(scene?.transition_duration || 0.5, maxAllowed, 1.0));

          let transitionAdded = false;

          // Attempt creation via TransitionBridge
          if (bridge.isInitialized()) {
            try {
              const defaultParams = bridge.getDefaultParams(transType);
              const params = {
                ...defaultParams,
                direction: transDir,
              };
              const res = bridge.createTransition(clipA, clipB, transType, transDur, params);
              if (res.success && res.transitionId) {
                const transObj = bridge.getTransition(res.transitionId);
                if (transObj) {
                  await projectStore.addClipTransition(transObj);
                  transitionAdded = true;
                }
              }
            } catch (err) {
              console.warn("[AI Studio] Bridge createTransition failed:", err);
            }
          }

          // Fallback direct OpenReel transition object injection
          if (!transitionAdded) {
            const directTrans: Transition = {
              id: `trans-${crypto.randomUUID()}`,
              clipAId: clipA.id,
              clipBId: clipB.id,
              type: transType,
              duration: transDur,
              params: {
                direction: transDir,
              },
            };
            await projectStore.addClipTransition(directTrans);
          }
        }
      }
    }

    // 5. Ingest Background Soundbed Music (if enabled & provided)
    if (params.include_soundbed !== false && aiProject.soundbed_path) {
      onProgress?.("Importing background soundbed music track...");
      if (!musicTrack) {
        const res = await projectStore.addTrack("audio", undefined, { name: "Music Track" });
        if (res?.success) {
          musicTrack = useProjectStore.getState().project.timeline.tracks.find((t) => t.name === "Music Track");
        }
      }

      const mTrackId = musicTrack?.id;
      const soundbedUrl = toStorageUrl(aiProject.soundbed_path);
      if (soundbedUrl && mTrackId) {
        const file = await fetchAsFile(soundbedUrl, "ambient_soundbed.mp3", "audio/mpeg");
        if (file) {
          const importRes = await projectStore.importMedia(file);
          if (importRes.success) {
            const mediaItem = useProjectStore
              .getState()
              .project.mediaLibrary.items.find((m) => m.name === file.name);
            const mediaId = mediaItem?.id;
            if (mediaId) {
              const addRes = await projectStore.addClip(mTrackId, mediaId, 0);
              const mClipId = (addRes as any)?.actionId;
              if (mClipId && (projectStore as any).updateAudioProperties) {
                // Duck music to 15% under speech
                (projectStore as any).updateAudioProperties(mClipId, { volume: 0.15 });
              }
            }
          }
        }
      }
    }

    onProgress?.("AI Video Storyboard successfully loaded into Timeline!");
    toast.success("AI Video Generated", `Imported ${scenes.length} scenes with ${addedVisualClips.length} dynamic cuts, voiceover & transitions!`);
    return { success: true, project: aiProject };
  } catch (err: any) {
    console.error("[AI Studio] Video generation failed:", err);
    toast.error("Generation Failed", err.message || "Failed to generate AI video");
    return { success: false, error: err.message || "Unknown error" };
  }
}

/**
 * Synchronizes OpenReel timeline visual cuts, headlines, and captions
 * to match the natural speech pauses of a selected audio clip using backend Whisper STT.
 */
export async function syncTimelineUsingAudio(
  audioClipId: string,
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const projectStore = useProjectStore.getState();
    const project = projectStore.getFullProject();

    // 1. Locate the selected audio clip and track
    let audioClip: Clip | undefined;
    let audioTrack: Track | undefined;

    for (const track of project.timeline.tracks) {
      const found = track.clips.find((c) => c.id === audioClipId);
      if (found) {
        audioClip = found;
        audioTrack = track;
        break;
      }
    }

    if (!audioClip) {
      return { success: false, error: "Audio clip not found on timeline." };
    }

    const mediaItem = projectStore.getMediaItem(audioClip.mediaId);
    if (!mediaItem) {
      return { success: false, error: "Audio media item not found in media library." };
    }

    // 2. Prepare audio URL or upload to backend
    let serverAudioUrl = mediaItem.originalUrl || "";
    if (!serverAudioUrl || !serverAudioUrl.includes("storage/")) {
      onProgress?.("Uploading audio clip to Whisper alignment engine...");
      const blob = mediaItem.blob || (mediaItem.fileHandle ? await mediaItem.fileHandle.getFile() : null);
      if (blob) {
        const formData = new FormData();
        const fileName = mediaItem.name || "timeline_audio.mp3";
        formData.append("file", blob, fileName);

        const uploadRes = await fetch("/api/upload-audio", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error(`Audio upload failed (${uploadRes.status})`);
        }
        const uploadData = await uploadRes.json();
        serverAudioUrl = uploadData.url;
      } else if (serverAudioUrl) {
        // Use existing URL
      } else {
        throw new Error("Cannot access raw audio data for synchronization.");
      }
    }

    // 3. Find primary visual track and visual clips
    const visualTracks = project.timeline.tracks.filter(
      (t) => t.type === "video" && t.name !== "Headlines Track" && t.name !== "Captions Track"
    );
    const primaryVisualTrack = visualTracks.find((t) => t.clips.length > 0) || visualTracks[0];
    const visualClips = primaryVisualTrack ? [...primaryVisualTrack.clips].sort((a, b) => a.startTime - b.startTime) : [];

    if (visualClips.length === 0) {
      return { success: false, error: "No visual clips found on the timeline to sync." };
    }

    onProgress?.(`Analyzing audio speech pauses with Whisper for ${visualClips.length} visual cuts...`);

    // 4. Call align backend
    const alignRes = await fetch("/api/align-custom-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio_url: serverAudioUrl,
        num_visual_clips: visualClips.length,
      }),
    });

    if (!alignRes.ok) {
      const err = await alignRes.json().catch(() => ({}));
      throw new Error(err.detail || "Audio speech alignment failed.");
    }

    const alignData = await alignRes.json();
    const alignedScenes = alignData.aligned_scenes || [];

    if (alignedScenes.length === 0) {
      throw new Error("No speech intervals were detected in this audio.");
    }

    onProgress?.("Aligning visual timeline clips to speech boundaries...");

    const audioOffset = audioClip.startTime;

    // 5. Update visual clips
    for (let i = 0; i < visualClips.length; i++) {
      const clip = visualClips[i];
      const seg = alignedScenes[i];
      if (!seg) break;

      const newStart = Math.max(0, audioOffset + seg.timeline_start);
      const newDur = Math.max(0.5, seg.audio_duration);

      // Trim duration
      await projectStore.trimClip(clip.id, clip.inPoint ?? 0, (clip.inPoint ?? 0) + newDur);
      // Move to exact speech pause midpoint
      await projectStore.moveClip(clip.id, newStart);
    }

    // 6. Ensure Headlines Track and Subtitles Track exist or create them
    let headlineTrack = project.timeline.tracks.find(
      (t) => t.name === "Headlines" || t.name === "Headlines Track"
    );
    if (!headlineTrack) {
      const res = await projectStore.addTrack("video", 0, { name: "Headlines", role: "captions" });
      if (res?.success) {
        headlineTrack = useProjectStore.getState().project.timeline.tracks.find((t) => t.name === "Headlines");
      }
    }

    let captionsTrack = project.timeline.tracks.find(
      (t) => t.name === "Subtitles" || t.name === "Captions Track" || t.name === "Captions"
    );
    if (!captionsTrack) {
      const res = await projectStore.addTrack("video", 0, { name: "Subtitles", role: "captions" });
      if (res?.success) {
        captionsTrack = useProjectStore.getState().project.timeline.tracks.find((t) => t.name === "Subtitles");
      }
    }

    // Capture existing headline texts to preserve them, or fall back to Whisper transcribed texts
    const allTextClips = projectStore.getAllTextClips
      ? projectStore.getAllTextClips()
      : ((useProjectStore.getState().project as any).textClips || []);

    const existingHeadlines: string[] = allTextClips
      .filter((tc: any) => tc.trackId === headlineTrack?.id)
      .sort((a: any, b: any) => a.startTime - b.startTime)
      .map((tc: any) => tc.text);

    // Delete existing text clips on headlines and captions tracks
    for (const tc of allTextClips) {
      if (tc.trackId === headlineTrack?.id || tc.trackId === captionsTrack?.id) {
        projectStore.deleteTextClip(tc.id);
      }
    }

    // Also remove any media clips from track.clips if present
    if (headlineTrack?.clips?.length) {
      for (const c of [...headlineTrack.clips]) {
        await projectStore.removeClip(c.id).catch(() => {});
      }
    }
    if (captionsTrack?.clips?.length) {
      for (const c of [...captionsTrack.clips]) {
        await projectStore.removeClip(c.id).catch(() => {});
      }
    }

    // 7. Recreate Synchronized Headlines at exact speech pauses (bottom y = 0.88, no background box)
    if (headlineTrack && projectStore.createTextClip) {
      for (let i = 0; i < alignedScenes.length; i++) {
        const seg = alignedScenes[i];
        const newStart = Math.max(0, audioOffset + seg.timeline_start);
        const newDur = Math.max(0.5, seg.audio_duration);
        const headlineText = existingHeadlines[i] || seg.text?.slice(0, 45) || `Headline ${i + 1}`;

        const hClip = projectStore.createTextClip(
          headlineTrack.id,
          newStart,
          headlineText,
          newDur,
          {
            fontFamily: "Inter, sans-serif",
            fontSize: 30,
            fontWeight: "bold",
            color: "#ffffff",
            strokeColor: "#000000",
            strokeWidth: 3,
            textAlign: "center",
          }
        );
        if (hClip && projectStore.updateTextTransform) {
          projectStore.updateTextTransform(hClip.id, {
            position: { x: 0.5, y: 0.88 },
          });
        }
      }
    }

    // 8. Recreate Synchronized Subtitles/Captions (above headline at y = 0.78, no background box)
    if (captionsTrack && projectStore.createTextClip) {
      for (const seg of alignedScenes) {
        const words = seg.word_timestamps;
        if (words && words.length > 0) {
          for (let w = 0; w < words.length; w += 4) {
            const chunk = words.slice(w, w + 4);
            const chunkText = chunk.map((c: any) => c.word).join(" ");
            const chunkStart = Math.max(0, audioOffset + (chunk[0]?.start ?? seg.timeline_start));
            const chunkEnd = Math.max(chunkStart + 0.5, audioOffset + (chunk[chunk.length - 1]?.end ?? (chunkStart + 1.2)));
            const chunkDur = Math.max(0.5, chunkEnd - chunkStart);

            const captionClip = projectStore.createTextClip(
              captionsTrack.id,
              chunkStart,
              chunkText,
              chunkDur,
              {
                fontFamily: "Inter, sans-serif",
                fontSize: 38,
                fontWeight: "bold",
                color: "#fbbf24",
                strokeColor: "#000000",
                strokeWidth: 3,
                textAlign: "center",
              }
            );
            if (captionClip && projectStore.updateTextTransform) {
              projectStore.updateTextTransform(captionClip.id, {
                position: { x: 0.5, y: 0.78 },
              });
            }
          }
        } else if (seg.text) {
          const newStart = Math.max(0, audioOffset + seg.timeline_start);
          const newDur = Math.max(0.5, seg.audio_duration);
          const captionClip = projectStore.createTextClip(
            captionsTrack.id,
            newStart,
            seg.text,
            newDur,
            {
              fontFamily: "Inter, sans-serif",
              fontSize: 38,
              fontWeight: "bold",
              color: "#fbbf24",
              strokeColor: "#000000",
              strokeWidth: 3,
              textAlign: "center",
            }
          );
          if (captionClip && projectStore.updateTextTransform) {
            projectStore.updateTextTransform(captionClip.id, {
              position: { x: 0.5, y: 0.78 },
            });
          }
        }
      }
    }

    const syncedCount = Math.min(visualClips.length, alignedScenes.length);
    toast.success(
      "Timeline Synced to Audio",
      `Successfully aligned ${syncedCount} visual cuts & speech pauses using Faster-Whisper!`
    );

    return { success: true };
  } catch (err: any) {
    console.error("[Speech Sync] Failed:", err);
    toast.error("Timeline Sync Failed", err.message || "Unknown error occurred");
    return { success: false, error: err.message || "Unknown error" };
  }
}

