import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import type { VideoProject, SceneData, VisualCandidate, SystemLogEntry } from '@/types/aiProject'
import { SCRIPT_PRESETS } from '@/types/aiProject'
import { useTimelineStore } from './useTimelineStore'
import { useMediaStore } from './useMediaStore'
import { usePlayerStore } from './usePlayerStore'
import { useHistoryStore } from './useHistoryStore'
import type { VideoClip, AudioClip, OverlayClip } from '@/types/clip'
import { DEFAULT_COLOR_FILTERS } from '@/types/clip'

export type AIStudioTab = 'script' | 'storyboard' | 'media' | 'logs' | 'settings'

export interface ExportSettings {
  includeSubtitles: boolean
  includeTicker: boolean
  includeMusic: boolean
  transition: string
  transitionDuration: number
}

interface AIProjectState {
  // Inputs
  scriptText: string
  projectTitle: string
  category: string
  theme: string
  aspectRatio: '16:9' | '9:16'
  voice: string
  serpApiKey: string
  maxShotDuration: number

  // Loaded project
  project: VideoProject | null
  activeSceneId: number | null
  activeTab: AIStudioTab

  // Export Settings
  exportSettings: ExportSettings

  // Operation flags
  isParsing: boolean
  isRendering: boolean
  isSyncingAudio: boolean
  renderProgress: number
  renderStage: string
  renderedVideoUrl: string | null

  // SERP / Media Swap Modal
  swapModalSceneId: number | null
  swapModalShotIndex: number
  swapModalClipId: string | null
  modalSearchQuery: string
  modalCandidates: VisualCandidate[]
  isSearchingModal: boolean

  // Logs
  logs: SystemLogEntry[]
  lastLogId: number

  // Actions
  setScriptText: (t: string) => void
  setProjectTitle: (t: string) => void
  setCategory: (c: string) => void
  setTheme: (t: string) => void
  setVoice: (v: string) => void
  setAspectRatio: (ar: '16:9' | '9:16') => void
  setSerpApiKey: (k: string) => void
  setMaxShotDuration: (d: number) => void
  setActiveSceneId: (id: number | null) => void
  setActiveTab: (tab: AIStudioTab) => void
  setExportSettings: (settings: Partial<ExportSettings>) => void
  loadPreset: (presetId: string) => void

  // Swap modal
  openSwapModal: (sceneId: number, shotIndex?: number, clipId?: string | null) => void
  closeSwapModal: () => void
  setModalSearchQuery: (q: string) => void
  searchModalMedia: (query?: string) => Promise<void>
  selectCandidateForScene: (sceneId: number, candidate: VisualCandidate, shotIndex?: number, clipId?: string | null) => Promise<void>

  // Core API calls
  parseScript: () => Promise<boolean>
  updateScene: (sceneId: number, fields: {
    narration_text?: string
    lower_third_headline?: string
    category_tag?: string
    motion_style?: string
    transition_type?: string
    transition_duration?: number
  }) => Promise<void>
  syncToTimeline: () => void
  syncTimelineWithAudio: (audioClipId?: string) => Promise<boolean>
  cancelSyncAudio: () => void
  renderProject: (options?: {
    includeSubtitles?: boolean
    includeTicker?: boolean
    includeMusic?: boolean
    transition?: string
    transitionDuration?: number
  }) => Promise<void>
  cancelRender: () => Promise<void>
  resetRender: () => void
  fetchLogs: () => Promise<void>
  clearLogs: () => Promise<void>
}

// Module-level abort controllers and timers
let syncAbortController: AbortController | null = null
let renderPollTimer: any = null

// Helper to format backend storage path into relative web URL
export function toMediaUrl(path?: string | null): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('/storage/')) {
    return path
  }
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/storage/')
  if (parts.length > 1) {
    return '/storage/' + parts[1]
  }
  const storageIndex = normalized.indexOf('storage/')
  if (storageIndex >= 0) {
    return '/' + normalized.substring(storageIndex)
  }
  return path
}

export const useAIProjectStore = create<AIProjectState>()(
  immer((set, get) => ({
    scriptText: SCRIPT_PRESETS[0].script,
    projectTitle: SCRIPT_PRESETS[0].title,
    category: SCRIPT_PRESETS[0].category,
    theme: SCRIPT_PRESETS[0].theme,
    aspectRatio: '16:9',
    voice: SCRIPT_PRESETS[0].voice,
    serpApiKey: '',
    maxShotDuration: 3.0,

    project: null,
    activeSceneId: null,
    activeTab: 'script',

    exportSettings: {
      includeSubtitles: true,
      includeTicker: false,
      includeMusic: true,
      transition: 'fade',
      transitionDuration: 0.5,
    },

    isParsing: false,
    isRendering: false,
    isSyncingAudio: false,
    renderProgress: 0,
    renderStage: '',
    renderedVideoUrl: null,

    swapModalSceneId: null,
    swapModalShotIndex: 0,
    swapModalClipId: null,
    modalSearchQuery: '',
    modalCandidates: [],
    isSearchingModal: false,

    logs: [],
    lastLogId: 0,

    setScriptText: (t) => set(s => { s.scriptText = t }),
    setProjectTitle: (t) => set(s => { s.projectTitle = t }),
    setCategory: (c) => set(s => { s.category = c }),
    setTheme: (t) => set(s => { s.theme = t }),
    setVoice: (v) => set(s => { s.voice = v }),
    setAspectRatio: (ar) => set(s => { s.aspectRatio = ar }),
    setSerpApiKey: (k) => set(s => { s.serpApiKey = k }),
    setMaxShotDuration: (d) => {
      set(s => { s.maxShotDuration = d })
      const proj = get().project
      if (proj && proj.scenes && proj.scenes.length > 0) {
        get().populateTimeline(proj)
      }
    },
    setActiveSceneId: (id) => set(s => { s.activeSceneId = id }),
    setActiveTab: (tab) => set(s => { s.activeTab = tab }),
    setExportSettings: (settings) => set(s => {
      s.exportSettings = { ...s.exportSettings, ...settings }
    }),

    loadPreset: (presetId) => {
      const p = SCRIPT_PRESETS.find(x => x.id === presetId)
      if (!p) return
      set(s => {
        s.scriptText = p.script
        s.projectTitle = p.title
        s.category = p.category
        s.theme = p.theme
        s.voice = p.voice
      })
      toast.success(`Loaded preset: ${p.label}`)
    },

    openSwapModal: (sceneId, shotIndex = 0, clipId = null) => {
      const proj = get().project
      const scene = proj?.scenes.find(sc => sc.scene_id === sceneId)
      set(s => {
        s.swapModalSceneId = sceneId
        s.swapModalShotIndex = shotIndex
        s.swapModalClipId = clipId
        s.modalSearchQuery = scene?.search_query || ''
        s.modalCandidates = scene?.visual_candidates || []
        s.isSearchingModal = false
      })
    },

    closeSwapModal: () => set(s => {
      s.swapModalSceneId = null
      s.swapModalShotIndex = 0
      s.swapModalClipId = null
      s.modalCandidates = []
    }),

    setModalSearchQuery: (q) => set(s => { s.modalSearchQuery = q }),

    searchModalMedia: async (customQuery) => {
      const query = customQuery || get().modalSearchQuery
      if (!query.trim()) return
      set(s => { s.isSearchingModal = true })
      try {
        const resp = await fetch('/api/search-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            category: get().category,
            serp_api_key: get().serpApiKey || undefined,
          }),
        })
        const data = await resp.json()
        if (data.success && data.candidates) {
          set(s => {
            s.modalCandidates = data.candidates
            s.isSearchingModal = false
          })
          toast.success(`Found ${data.candidates.length} visual results`)
        } else {
          set(s => { s.isSearchingModal = false })
          toast.error('No visuals found for query')
        }
      } catch (err: any) {
        set(s => { s.isSearchingModal = false })
        toast.error(`Search error: ${err.message}`)
      }
    },

    selectCandidateForScene: async (sceneId, candidate, shotIndex = 0, clipId = null) => {
      const proj = get().project
      if (!proj) return
      const targetShot = shotIndex ?? get().swapModalShotIndex ?? 0
      const targetClip = clipId ?? get().swapModalClipId
      const toastId = toast.loading(`Downloading & applying visual for Scene ${sceneId} (Part ${targetShot + 1})...`)
      try {
        const resp = await fetch('/api/select-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: proj.project_id,
            scene_id: sceneId,
            shot_index: targetShot,
            image_url: candidate.image_url || candidate.thumbnail_url || '',
            thumbnail_url: candidate.thumbnail_url,
            title: candidate.title,
            source: candidate.source,
          }),
        })
        const data = await resp.json()
        if (data.success && data.scene) {
          set(s => {
            if (s.project) {
              const idx = s.project.scenes.findIndex(sc => sc.scene_id === sceneId)
              if (idx >= 0) {
                s.project.scenes[idx] = data.scene
              }
            }
            s.swapModalSceneId = null
            s.swapModalShotIndex = 0
            s.swapModalClipId = null
          })
          toast.success(`Scene ${sceneId} [Part ${targetShot + 1}] visual updated!`, { id: toastId })
          get().syncToTimeline()

          if (targetClip && data.scene.all_media_paths && data.scene.all_media_paths[targetShot]) {
            const newUrl = toMediaUrl(data.scene.all_media_paths[targetShot])
            useTimelineStore.getState().updateClip(targetClip, { src: newUrl })
          }
        } else {
          toast.error(data.detail || 'Failed to select media', { id: toastId })
        }
      } catch (err: any) {
        toast.error(`Select error: ${err.message}`, { id: toastId })
      }
    },

    parseScript: async () => {
      const { scriptText, projectTitle, category, theme, aspectRatio, voice, serpApiKey, maxShotDuration } = get()
      if (!scriptText.trim()) {
        toast.error('Please enter a script first')
        return false
      }

      set(s => { s.isParsing = true })
      const toastId = toast.loading('AI Parsing script & generating voiceover + visuals...')

      // Start high-frequency live log stream polling (every 350ms)
      const logPoller = setInterval(() => {
        get().fetchLogs()
      }, 350)
      get().fetchLogs()

      try {
        const resp = await fetch('/api/parse-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            script_text: scriptText,
            project_title: projectTitle || 'AI News Video',
            category,
            theme,
            aspect_ratio: aspectRatio,
            voice,
            serp_api_key: serpApiKey || undefined,
            max_shot_duration: maxShotDuration,
          }),
        })

        const data = await resp.json()
        if (!data.success || !data.project) {
          toast.error(data.detail || 'Script parsing failed', { id: toastId })
          set(s => { s.isParsing = false })
          return false
        }

        const project: VideoProject = data.project
        set(s => {
          s.project = project
          s.activeSceneId = project.scenes[0]?.scene_id ?? 1
          s.isParsing = false
          s.activeTab = 'storyboard'
        })

        toast.success(`Generated storyboard with ${project.scenes.length} scenes!`, { id: toastId })
        // Auto-populate multi-track timeline
        get().syncToTimeline()
        return true
      } catch (err: any) {
        set(s => { s.isParsing = false })
        toast.error(`Network error: ${err.message}`, { id: toastId })
        return false
      } finally {
        clearInterval(logPoller)
        await get().fetchLogs()
      }
    },

    updateScene: async (sceneId, fields) => {
      const proj = get().project
      if (!proj) return

      // Optimistic update locally immediately so live preview and timeline reflect changes instantly
      set(s => {
        if (s.project) {
          const idx = s.project.scenes.findIndex(sc => sc.scene_id === sceneId)
          if (idx >= 0) {
            s.project.scenes[idx] = { ...s.project.scenes[idx], ...fields }
          }
        }
      })
      get().syncToTimeline()

      try {
        const resp = await fetch('/api/update-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: proj.project_id,
            scene_id: sceneId,
            ...fields,
          }),
        })

        const data = await resp.json()
        if (data.success && data.scene) {
          set(s => {
            if (s.project) {
              const idx = s.project.scenes.findIndex(sc => sc.scene_id === sceneId)
              if (idx >= 0) {
                s.project.scenes[idx] = { ...s.project.scenes[idx], ...data.scene }
              }
              if (data.total_timeline_duration) {
                s.project.total_timeline_duration = data.total_timeline_duration
              }
              if (data.scenes) {
                s.project.scenes = data.scenes
              }
            }
          })
          get().syncToTimeline()
        }
      } catch (err: any) {
        toast.error(`Update error: ${err.message}`)
      }
    },

    syncToTimeline: () => {
      const proj = get().project
      if (!proj || !proj.scenes || proj.scenes.length === 0) return

      const timelineStore = useTimelineStore.getState()
      const mediaStore = useMediaStore.getState()
      const playerStore = usePlayerStore.getState()

      // Find tracks
      const vTrack = timelineStore.timeline.tracks.find(t => t.type === 'video')
      const aTrack = timelineStore.timeline.tracks.find(t => t.type === 'audio')
      const mTrack = timelineStore.timeline.tracks.find(t => t.type === 'music')
      const oTrack = timelineStore.timeline.tracks.find(t => t.type === 'overlay')

      if (!vTrack || !aTrack) return

      // Clear existing clips on these tracks and rebuild
      const newVClips: VideoClip[] = []
      const newAClips: AudioClip[] = []
      const newOClips: OverlayClip[] = []

      let runningStart = 0
      proj.scenes.forEach((sc) => {
        // Enforce contiguous timing with previous scene to eliminate gaps
        const start = (sc.timeline_start !== undefined && sc.timeline_start >= runningStart)
          ? sc.timeline_start
          : runningStart
        const rawDur = (sc.timeline_end && sc.timeline_end > start)
          ? (sc.timeline_end - start)
          : (sc.audio_duration || 3)
        const duration = Math.max(rawDur, 1.0)
        const end = start + duration
        runningStart = end

        // Available image urls for this scene (including all downloaded candidate photos)
        const sceneImages: string[] = []
        if (sc.all_media_paths && sc.all_media_paths.length > 0) {
          sc.all_media_paths.forEach(p => {
            const u = toMediaUrl(p)
            if (u && !sceneImages.includes(u)) sceneImages.push(u)
          })
        }
        if (sc.local_media_path) {
          const u = toMediaUrl(sc.local_media_path)
          if (u && !sceneImages.includes(u)) sceneImages.unshift(u)
        }
        if (sc.selected_visual?.image_url) {
          const u = sc.selected_visual.image_url
          if (u && !sceneImages.includes(u)) sceneImages.push(u)
        }
        if (sceneImages.length === 0) {
          sceneImages.push('https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=1280&q=80')
        }

        // Add all candidate photos to media store for easy swapping
        sceneImages.forEach((imgUrl, imgIdx) => {
          mediaStore.addAsset({
            id: `scene-img-${sc.scene_id}-${imgIdx}`,
            name: `Scene ${sc.scene_id} - Shot ${imgIdx + 1} (${sc.primary_entity || 'Photo'})`,
            type: 'image',
            src: imgUrl,
            addedAt: new Date().toISOString(),
          })
        })

        // Sub-divide long scenes: First part keeps maxShotDur, next part gets remainder (>50% threshold)
        const maxShotDur = Math.max(1.5, get().maxShotDuration || proj.max_shot_duration || 3.0)
        const threshold = maxShotDur * 0.5
        const fullShots = Math.floor(duration / maxShotDur)
        const remainder = Math.round((duration - (fullShots * maxShotDur)) * 1000) / 1000

        let shotDurations: number[] = []
        if (duration > maxShotDur) {
          if (remainder >= threshold) {
            shotDurations = Array(fullShots).fill(maxShotDur).concat([remainder])
          } else {
            if (fullShots > 1) {
              shotDurations = Array(fullShots - 1).fill(maxShotDur).concat([Math.round((maxShotDur + remainder) * 1000) / 1000])
            } else {
              shotDurations = [duration]
            }
          }
        } else {
          shotDurations = [duration]
        }
        const numSubShots = shotDurations.length
        const motionCycle: Array<'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right'> = [
          (sc.motion_style as any) || 'zoom_in',
          'zoom_out',
          'pan_left',
          'pan_right',
        ]

        let curSubStart = start
        for (let k = 0; k < numSubShots; k++) {
          const subDur = shotDurations[k]
          const subStart = curSubStart
          const subEnd = (k === numSubShots - 1) ? end : subStart + subDur
          curSubStart = subEnd
          const subDuration = Math.round((subEnd - subStart) * 1000) / 1000
          // Strictly pick the next distinct image for each cut (Shot 1 -> Photo 1, Shot 2 -> Photo 2, Shot 3 -> Photo 3)
          const subImage = (sc.all_media_paths && sc.all_media_paths[k])
            ? toMediaUrl(sc.all_media_paths[k])
            : (sceneImages[k] || sceneImages[k % sceneImages.length])
          const subMotion = motionCycle[k % motionCycle.length]
          const clipId = (numSubShots === 1) ? `clip-v-${sc.scene_id}` : `clip-v-${sc.scene_id}-${k + 1}`
          const existingClip = vTrack.clips.find(c => c.id === clipId) as VideoClip | undefined

          // 1. Video/Image clip on V1
          newVClips.push({
            id: clipId,
            trackId: vTrack.id,
            type: 'video',
            name: (numSubShots > 1)
              ? `Scene ${sc.scene_id} [${k + 1}/${numSubShots}]: ${sc.primary_entity || sc.narration_text.substring(0, 14)}`
              : `Scene ${sc.scene_id}: ${sc.primary_entity || sc.narration_text.substring(0, 18)}`,
            src: subImage,
            startTime: subStart,
            duration: subDuration,
            fileStart: 0,
            fileEnd: subDuration,
            originalDuration: subDuration,
            filters: (existingClip?.filters && existingClip.filters.preset && existingClip.filters.preset !== 'none') ? existingClip.filters : DEFAULT_COLOR_FILTERS,
            motion: existingClip?.motion || subMotion,
            effect: existingClip?.effect,
            speed: existingClip?.speed ?? 1,
            opacity: existingClip?.opacity ?? 1,
            transition: {
              type: (sc.transition_type as any) || existingClip?.transition?.type || 'fade',
              duration: sc.transition_duration || existingClip?.transition?.duration || 0.5,
              position: 'end',
            },
          })
        }

        // 2. Audio TTS clip on A1 (Seamless contiguous placement without gaps)
        const audioUrl = toMediaUrl(sc.local_audio_path || proj.master_audio_path)
        if (audioUrl) {
          mediaStore.addAsset({
            id: `scene-aud-${sc.scene_id}`,
            name: `Narration Scene ${sc.scene_id}`,
            type: 'audio',
            src: audioUrl,
            duration: duration,
            addedAt: new Date().toISOString(),
          })

          const normLocal = sc.local_audio_path ? toMediaUrl(sc.local_audio_path) : ''
          const normMaster = proj.master_audio_path ? toMediaUrl(proj.master_audio_path) : ''
          const isMaster = Boolean(
            (normMaster && normLocal && normLocal === normMaster) ||
            (!normLocal && normMaster) ||
            (audioUrl && (audioUrl.includes('master_narration') || audioUrl.includes('master_audio') || audioUrl.includes('master_synchronized')))
          )
          newAClips.push({
            id: `clip-a-${sc.scene_id}`,
            trackId: aTrack.id,
            type: 'audio',
            name: `VO Scene ${sc.scene_id} (${duration.toFixed(1)}s)`,
            src: audioUrl,
            startTime: start,
            duration: duration,
            fileStart: isMaster ? start : 0,
            fileEnd: isMaster ? end : duration,
            originalDuration: isMaster ? (proj.total_timeline_duration || 30) : duration,
            volume: 1,
            fadeIn: 0.05,
            fadeOut: 0.05,
            pan: 0,
            muted: false,
          })
        }

        // 3. Lower-third headline overlay on O1
        if (oTrack && (sc.lower_third_headline || sc.category_tag)) {
          newOClips.push({
            id: `clip-o-${sc.scene_id}`,
            trackId: oTrack.id,
            type: 'overlay',
            overlayType: 'text',
            name: `Headline: ${sc.lower_third_headline || sc.category_tag}`,
            startTime: start,
            duration: duration,
            fabricJson: '',
            x: 0.05,
            y: 0.8,
            width: 0.9,
            height: 0.15,
            animation: 'slide_up',
          })
        }
      })

      // Update tracks in timeline
      timelineStore.updateTrack(vTrack.id, { clips: newVClips })
      timelineStore.updateTrack(aTrack.id, { clips: newAClips })
      if (oTrack) {
        timelineStore.updateTrack(oTrack.id, { clips: newOClips })
      }

      const totalDur = Math.max(
        proj.total_timeline_duration || 0,
        runningStart,
        newVClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0),
        10
      )

      // Keep MTrack (music layer) empty by default; only retain clips if user explicitly added them
      if (mTrack) {
        const existingClips = (mTrack.clips || []) as AudioClip[]
        const userMusicClips = existingClips.filter(c => c.id !== 'clip-m-ambient')
        timelineStore.updateTrack(mTrack.id, { clips: userMusicClips })
      }

      // Recalculate duration
      timelineStore.recalcDuration()
      playerStore.setDuration(totalDur)
    },

    syncTimelineWithAudio: async (audioClipId?: string) => {
      const timelineStore = useTimelineStore.getState()
      const playerStore = usePlayerStore.getState()
      const proj = get().project

      // 1. Locate custom audio track & target audio clip
      const customTrack = timelineStore.timeline.tracks.find(
        t => (t.id === 'track-custom-audio' || t.name.toLowerCase().includes('custom')) && t.type === 'audio'
      )

      let audioClip: AudioClip | undefined
      if (audioClipId) {
        audioClip = timelineStore.timeline.tracks.flatMap(t => t.clips).find(c => c.id === audioClipId) as AudioClip
      }
      if (!audioClip && customTrack && customTrack.clips.length > 0) {
        audioClip = customTrack.clips[0] as AudioClip
      }
      if (!audioClip) {
        toast.error('No audio clip found to synchronize with')
        return false
      }

      // 2. Locate V1 video track & clips
      const vTrack = timelineStore.timeline.tracks.find(t => t.type === 'video')
      if (!vTrack || vTrack.clips.length === 0) {
        toast.error('No clips found on V1 layer to adjust')
        return false
      }

      const vClips = [...(vTrack.clips as VideoClip[])].sort((a, b) => a.startTime - b.startTime)
      const currentTotalV1Dur = vClips.reduce((sum, c) => sum + c.duration, 0)
      if (currentTotalV1Dur <= 0) {
        toast.error('Current V1 clips duration is 0')
        return false
      }

      if (get().isSyncingAudio) return false

      if (syncAbortController) {
        syncAbortController.abort()
      }
      syncAbortController = new AbortController()
      const signal = syncAbortController.signal

      set(s => { s.isSyncingAudio = true })

      // Live log poller so backend Whisper alignment progress appears instantly in logs
      const logPoller = setInterval(() => {
        get().fetchLogs()
      }, 350)
      get().fetchLogs()

      const toastId = toast.loading('🧠 AI Analyzing spoken speech & aligning scene cuts...')

      try {
        let targetAudioDuration = audioClip.duration
        let alignedScenesData: any[] | null = null

        // Upload blob: audio to server if needed
        let audioSrc = audioClip.src
        if (audioSrc && audioSrc.startsWith('blob:')) {
          try {
            const res = await fetch(audioSrc, { signal })
            const blob = await res.blob()
            const b64 = await new Promise<string>((resolve, reject) => {
              const r = new FileReader()
              r.onload = () => resolve(r.result as string)
              r.onerror = reject
              r.readAsDataURL(blob)
            })
            const upRes = await fetch('/api/upload-media', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: audioClip.name || 'custom_audio.mp3', data: b64 }),
              signal,
            })
            if (upRes.ok) {
              const upData = await upRes.json()
              if (upData.url) {
                audioSrc = upData.url
                timelineStore.updateClip(audioClip.id, { src: upData.url })
              }
            }
          } catch (e: any) {
            if (e.name === 'AbortError' || signal.aborted) throw e
            console.warn('Could not upload blob audio for alignment:', e)
          }
        }

        // Try AI Whisper Word-Boundary Alignment if script scenes are available
        if (proj && proj.scenes && proj.scenes.length > 0 && audioSrc) {
          try {
            const alignResp = await fetch('/api/align-custom-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                project_id: proj.project_id,
                audio_url: audioSrc,
                scenes: proj.scenes.map(s => ({ scene_id: s.scene_id, narration_text: s.narration_text }))
              }),
              signal
            })
            if (alignResp.ok) {
              const alignData = await alignResp.json()
              if (alignData.success && alignData.aligned_scenes && alignData.aligned_scenes.length > 0) {
                alignedScenesData = alignData.aligned_scenes
                if (alignData.total_duration) {
                  targetAudioDuration = alignData.total_duration
                }
              }
            }
          } catch (err: any) {
            if (err.name === 'AbortError' || signal.aborted) throw err
            console.warn('AI Speech alignment API failed, falling back to proportional pacing:', err)
          }
        }

      const updatedVClips: VideoClip[] = []

      if (alignedScenesData && proj && proj.scenes) {
        // === MODE A: 100% Exact AI Speech-To-Text Word Boundary Sync ===
        alignedScenesData.forEach((scData: any) => {
          const scId = scData.scene_id
          const scStart = scData.timeline_start
          const scEnd = scData.timeline_end
          const scDur = scData.audio_duration

          const sceneClips = vClips.filter(c =>
            c.id === `clip-v-${scId}` || c.id.startsWith(`clip-v-${scId}-`)
          )
          const targetClips = sceneClips.length > 0 ? sceneClips : []
          if (targetClips.length === 0) return

          const sceneTotalBefore = targetClips.reduce((sum, c) => sum + c.duration, 0)
          let curSubStart = scStart

          targetClips.forEach((c, idx) => {
            const isLast = idx === targetClips.length - 1
            const newDur = isLast
              ? Math.max(0.5, Math.round((scEnd - curSubStart) * 1000) / 1000)
              : Math.max(0.5, Math.round(((c.duration / (sceneTotalBefore || 1)) * scDur) * 1000) / 1000)

            const finalStart = Math.round(curSubStart * 1000) / 1000
            curSubStart += newDur

            updatedVClips.push({
              ...c,
              startTime: finalStart,
              duration: newDur,
              fileStart: 0,
              fileEnd: newDur,
              originalDuration: newDur,
            })
          })
        })

        // Also update project scenes
        const updatedScenes = proj.scenes.map(sc => {
          const match = alignedScenesData!.find((d: any) => d.scene_id === sc.scene_id)
          if (match) {
            return {
              ...sc,
              timeline_start: match.timeline_start,
              timeline_end: match.timeline_end,
              audio_duration: match.audio_duration,
              word_timestamps: match.word_timestamps || sc.word_timestamps
            }
          }
          return sc
        })

        set(s => {
          if (s.project) {
            s.project.scenes = updatedScenes
            s.project.total_timeline_duration = targetAudioDuration
          }
        })
      } else {
        // === MODE B: Fallback Proportional Relative Pacing Scaling ===
        let accumulatedStart = 0
        const scale = targetAudioDuration / currentTotalV1Dur

        for (let i = 0; i < vClips.length; i++) {
          const c = vClips[i]
          const isLast = i === vClips.length - 1
          const newDur = isLast
            ? Math.max(0.5, Math.round((targetAudioDuration - accumulatedStart) * 1000) / 1000)
            : Math.max(0.5, Math.round((c.duration * scale) * 1000) / 1000)

          const curStart = Math.round(accumulatedStart * 1000) / 1000
          accumulatedStart += newDur

          updatedVClips.push({
            ...c,
            startTime: curStart,
            duration: newDur,
            fileStart: 0,
            fileEnd: newDur,
            originalDuration: newDur,
          })
        }

        if (proj && proj.scenes && proj.scenes.length > 0) {
          const updatedScenes = proj.scenes.map((sc, scIdx) => {
            const scClips = updatedVClips.filter(c =>
              c.id === `clip-v-${sc.scene_id}` || c.id.startsWith(`clip-v-${sc.scene_id}-`)
            )
            let scStart: number
            let scEnd: number
            if (scClips.length > 0) {
              scStart = scClips[0].startTime
              const lastScClip = scClips[scClips.length - 1]
              scEnd = Math.round((lastScClip.startTime + lastScClip.duration) * 1000) / 1000
            } else {
              scStart = Math.round(((scIdx / proj.scenes.length) * targetAudioDuration) * 1000) / 1000
              scEnd = Math.round((((scIdx + 1) / proj.scenes.length) * targetAudioDuration) * 1000) / 1000
            }
            const scDur = Math.round((scEnd - scStart) * 1000) / 1000
            return {
              ...sc,
              timeline_start: scStart,
              timeline_end: scEnd,
              audio_duration: scDur,
            }
          })

          set(s => {
            if (s.project) {
              s.project.scenes = updatedScenes
              s.project.total_timeline_duration = targetAudioDuration
            }
          })
        }
      }

      // Update overlay track subtitles/lower-thirds
      const oTrack = timelineStore.timeline.tracks.find(t => t.type === 'overlay')
      if (oTrack && oTrack.clips.length > 0 && proj && proj.scenes) {
        const updatedOClips = oTrack.clips.map(oc => {
          const match = oc.id.match(/^clip-o-(\d+)$/)
          if (match) {
            const scId = parseInt(match[1], 10)
            const scClips = updatedVClips.filter(c => c.id === `clip-v-${scId}` || c.id.startsWith(`clip-v-${scId}-`))
            if (scClips.length > 0) {
              const start = scClips[0].startTime
              const end = scClips[scClips.length - 1].startTime + scClips[scClips.length - 1].duration
              return {
                ...oc,
                startTime: start,
                duration: Math.round((end - start) * 1000) / 1000,
              }
            }
          }
          return oc
        })
        timelineStore.updateTrack(oTrack.id, { clips: updatedOClips })
      }

      // Mute A1 narration track so custom audio takes over
      const aTrack = timelineStore.timeline.tracks.find(
        t => t.type === 'audio' && t.id !== 'track-custom-audio' && !t.name.toLowerCase().includes('custom')
      )
      if (aTrack && !aTrack.muted && aTrack.clips.length > 0) {
        timelineStore.updateTrack(aTrack.id, { muted: true })
      }
      if (customTrack && customTrack.muted) {
        timelineStore.updateTrack(customTrack.id, { muted: false })
      }

      // Update V1 track and timeline bounds
      timelineStore.updateTrack(vTrack.id, { clips: updatedVClips })
      timelineStore.recalcDuration()
      playerStore.setDuration(targetAudioDuration)

      useHistoryStore.getState().pushHistory('Sync timeline with audio')
      const modeLabel = alignedScenesData ? 'Speech AI Word-Sync' : 'Proportional Sync'
      toast.success(`⚡ ${modeLabel}: ${updatedVClips.length} visual cuts locked to audio speech! (${targetAudioDuration.toFixed(1)}s)`, { id: toastId })
      return true
    } catch (err: any) {
      if (err.name === 'AbortError' || signal.aborted) {
        toast('Speech alignment cancelled', { id: toastId, icon: '🛑' })
        return false
      }
      toast.error(`Sync error: ${err.message}`, { id: toastId })
      return false
    } finally {
      clearInterval(logPoller)
      syncAbortController = null
      set(s => { s.isSyncingAudio = false })
      await get().fetchLogs()
    }
  },

  cancelSyncAudio: () => {
    if (syncAbortController) {
      syncAbortController.abort()
      syncAbortController = null
    }
    set(s => { s.isSyncingAudio = false })
    toast('Audio speech sync cancelled', { icon: '🛑' })
    fetch('/api/system-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'WARNING',
        source: 'SYNC',
        message: 'Audio speech alignment cancelled by user'
      })
    }).catch(() => {})
    get().fetchLogs()
  },

    resetRender: () => {
      set(s => {
        s.renderedVideoUrl = null
        s.isRendering = false
        s.renderProgress = 0
        s.renderStage = ''
      })
    },

    renderProject: async (options) => {
      const proj = get().project
      const timelineState = useTimelineStore.getState()
      const vTrack = timelineState.timeline.tracks.find(t => t.type === 'video')
      const aTrack = timelineState.timeline.tracks.find(t => t.type === 'audio' && t.id !== 'track-custom-audio' && !t.name.toLowerCase().includes('custom'))
        || timelineState.timeline.tracks.find(t => t.type === 'audio')
      const customTrack = timelineState.timeline.tracks.find(t => (t.id === 'track-custom-audio' || t.name.toLowerCase().includes('custom')) && t.type === 'audio')
      const mTrack = timelineState.timeline.tracks.find(t => t.type === 'music')
      const oTrack = timelineState.timeline.tracks.find(t => t.type === 'overlay')

      const projectId = proj?.project_id || `timeline_${nanoid()}`

      // Reset state for new render so old video is never shown
      set(s => {
        s.isRendering = true
        s.renderedVideoUrl = null
        s.renderProgress = 5
        s.renderStage = 'Preparing timeline media & assets...'
      })

      // Convert timeline video/image clips into scenes payload
      const vClips = [...((vTrack?.clips || []) as VideoClip[])].sort((a, b) => a.startTime - b.startTime)
      let scenesPayload: any[] = []

      if (vClips.length > 0) {
        // Upload any blob: URLs to server first
        for (let i = 0; i < vClips.length; i++) {
          const clip = vClips[i]
          let mediaSrc = clip.src
          if (mediaSrc && mediaSrc.startsWith('blob:')) {
            try {
              const res = await fetch(mediaSrc)
              const blob = await res.blob()
              const b64 = await new Promise<string>((resolve, reject) => {
                const r = new FileReader()
                r.onload = () => resolve(r.result as string)
                r.onerror = reject
                r.readAsDataURL(blob)
              })
              const upRes = await fetch('/api/upload-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: clip.name || `clip_${i}.jpg`, data: b64 }),
              })
              if (upRes.ok) {
                const upData = await upRes.json()
                if (upData.url) mediaSrc = upData.url
              }
            } catch (e) {
              console.warn('Could not upload blob clip:', e)
            }
          }

          const midPoint = clip.startTime + clip.duration / 2
          const isAudioTrackMuted = !!aTrack?.muted
          const isCustomTrackMuted = !!customTrack?.muted
          // Find matching audio clip covering this clip's time range: check A1 first, then Custom Audio
          let matchingAudio = isAudioTrackMuted ? null : aTrack?.clips.find(c => {
            const cEnd = c.startTime + c.duration
            return (c.startTime <= midPoint && cEnd > midPoint) ||
                   (clip.startTime <= c.startTime && clip.startTime + clip.duration >= cEnd)
          })
          if (!matchingAudio && !isCustomTrackMuted && customTrack && customTrack.clips.length > 0) {
            matchingAudio = customTrack.clips.find(c => {
              const cEnd = c.startTime + c.duration
              return (c.startTime <= midPoint && cEnd > midPoint) ||
                     (clip.startTime <= c.startTime && clip.startTime + clip.duration >= cEnd) ||
                     (c.startTime < clip.startTime + clip.duration && cEnd > clip.startTime)
            })
            // If custom audio track has an active clip, fallback to it
            if (!matchingAudio) {
              matchingAudio = (customTrack.clips as AudioClip[]).find(c => !c.muted && c.src) || (customTrack.clips[0] as AudioClip)
            }
          }
          const isFromCustom = matchingAudio && customTrack?.clips.some(c => c.id === matchingAudio.id)
          const isSourceTrackMuted = isFromCustom ? isCustomTrackMuted : isAudioTrackMuted
          const isClipMuted = matchingAudio ? (!!(matchingAudio as any).muted || isSourceTrackMuted) : false
          const matchingOverlay = oTrack?.clips.find(c => midPoint >= c.startTime && midPoint < c.startTime + c.duration)

          let audioSrc = (!isClipMuted && (matchingAudio as any)?.src) ? (matchingAudio as any).src : null
          if (audioSrc && audioSrc.startsWith('blob:')) {
            try {
              const res = await fetch(audioSrc)
              const blob = await res.blob()
              const b64 = await new Promise<string>((resolve, reject) => {
                const r = new FileReader()
                r.onload = () => resolve(r.result as string)
                r.onerror = reject
                r.readAsDataURL(blob)
              })
              const upRes = await fetch('/api/upload-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: matchingAudio?.name || `audio_${i}.mp3`, data: b64 }),
              })
              if (upRes.ok) {
                const upData = await upRes.json()
                if (upData.url) audioSrc = upData.url
              }
            } catch (e) {
              console.warn('Could not upload blob audio:', e)
            }
          }

          // Calculate precise audio offset into the matching audio file
          const audioOffset = matchingAudio
            ? Math.max(0, (clip.startTime - matchingAudio.startTime) + (matchingAudio.fileStart || 0))
            : 0

          const clipVol = matchingAudio && typeof (matchingAudio as any).volume === 'number' ? (matchingAudio as any).volume : 1.0
          const sourceTrackVol = isFromCustom
            ? (typeof customTrack?.volume === 'number' ? customTrack.volume : 1.0)
            : (typeof aTrack?.volume === 'number' ? aTrack.volume : 1.0)
          const totalAudioVol = clipVol * sourceTrackVol

          scenesPayload.push({
            scene_id: i + 1,
            search_query: clip.name || 'custom_clip',
            narration_text: matchingOverlay?.name || '',
            lower_third_headline: matchingOverlay?.name || '',
            category_tag: 'NEWS',
            motion_style: (clip as any).motion || 'zoom_in',
            transition_type: clip.transition?.type || options?.transition || 'fade',
            transition_duration: clip.transition?.duration || options?.transitionDuration || 0.5,
            timeline_start: clip.startTime,
            timeline_end: clip.startTime + clip.duration,
            local_media_path: mediaSrc,
            all_media_paths: [mediaSrc],
            local_audio_path: audioSrc,
            audio_offset: audioOffset,
            audio_volume: totalAudioVol,
          })
        }
      } else if (proj && proj.scenes.length > 0) {
        scenesPayload = proj.scenes.map(s => ({
          scene_id: s.scene_id,
          narration_text: s.narration_text,
          lower_third_headline: s.lower_third_headline,
          category_tag: s.category_tag,
          motion_style: s.motion_style,
          transition_type: s.transition_type,
          transition_duration: s.transition_duration,
          timeline_start: s.timeline_start,
          timeline_end: s.timeline_end,
          local_media_path: s.local_media_path,
          all_media_paths: s.all_media_paths && s.all_media_paths.length > 0 ? s.all_media_paths : ([s.local_media_path].filter(Boolean) as string[]),
          local_audio_path: s.local_audio_path,
        }))
      }

      if (scenesPayload.length === 0) {
        toast.error('No clips to export! Add photos or videos to timeline.')
        set(s => { s.isRendering = false })
        return
      }

      // Check music track
      const isMusicTrackMuted = !!mTrack?.muted || (mTrack?.clips?.length === 0)
      let customSoundbedPath: string | null = null
      let soundbedVolume: number = 1.0

      if (mTrack && mTrack.clips.length > 0 && !isMusicTrackMuted) {
        const selectedClip = timelineState.selectedClipId
          ? (mTrack.clips as AudioClip[]).find(c => c.id === timelineState.selectedClipId)
          : null
        const musicClip = (selectedClip && !selectedClip.muted ? selectedClip : null)
          || (mTrack.clips as AudioClip[]).find(c => !c.muted && c.src)
          || (mTrack.clips[0] as AudioClip)

        if (musicClip && !musicClip.muted) {
          const rawVol = typeof musicClip.volume === 'number' ? musicClip.volume : 1.0
          const trackVol = typeof mTrack.volume === 'number' ? mTrack.volume : 1.0
          soundbedVolume = rawVol * trackVol
          let musicSrc = musicClip.src
          if (musicSrc && musicSrc.startsWith('blob:')) {
            try {
              const res = await fetch(musicSrc)
              const blob = await res.blob()
              const b64 = await new Promise<string>((resolve, reject) => {
                const r = new FileReader()
                r.onload = () => resolve(r.result as string)
                r.onerror = reject
                r.readAsDataURL(blob)
              })
              const upRes = await fetch('/api/upload-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: musicClip.name || 'custom_music.mp3', data: b64 }),
              })
              if (upRes.ok) {
                const upData = await upRes.json()
                if (upData.url) musicSrc = upData.url
              }
            } catch (e) {
              console.warn('Could not upload blob music:', e)
            }
          }
          customSoundbedPath = musicSrc || null
        }
      }

      try {
        const currentExp = get().exportSettings
        const resp = await fetch('/api/render-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            scenes: scenesPayload,
            include_subtitles: options?.includeSubtitles ?? currentExp.includeSubtitles,
            include_ticker: options?.includeTicker ?? currentExp.includeTicker,
            include_music: (options?.includeMusic ?? currentExp.includeMusic) && !isMusicTrackMuted && !!customSoundbedPath,
            custom_soundbed_path: customSoundbedPath,
            soundbed_volume: soundbedVolume,
            default_transition: options?.transition ?? currentExp.transition,
            transition_duration: options?.transitionDuration ?? currentExp.transitionDuration,
            max_shot_duration: get().maxShotDuration,
          }),
        })

        const data = await resp.json()
        if (!data.success) {
          toast.error(data.detail || 'Render trigger failed')
          set(s => { s.isRendering = false })
          return
        }

        toast.success('Render job started! Compositing broadcast video...')

        // Poll status every 1.5s
        if (renderPollTimer) clearInterval(renderPollTimer)
        renderPollTimer = setInterval(async () => {
          try {
            const statusResp = await fetch(`/api/project-status/${projectId}`)
            const statusData = await statusResp.json()

            if (statusData.status === 'cancelled') {
              clearInterval(renderPollTimer)
              renderPollTimer = null
              get().fetchLogs()
              set(s => {
                s.isRendering = false
                s.renderProgress = 0
                s.renderStage = 'Export cancelled'
              })
              return
            }

            const pct = statusData.progress_percent || 0
            let stageDesc = 'Synthesizing voiceover & media timing...'
            if (pct > 25 && pct <= 60) stageDesc = 'Sizing visuals & Ken Burns motion...'
            if (pct > 60 && pct < 90) stageDesc = 'Single-pass FFmpeg compositing & xfade transitions...'
            if (pct >= 90 && pct < 100) stageDesc = 'Finalizing 1080p MP4 broadcast stream...'
            if (pct === 100) stageDesc = 'Export complete!'

            set(s => {
              s.renderProgress = pct
              s.renderStage = `${pct}% — ${stageDesc}`
            })

            // Also pull latest logs during render polling
            get().fetchLogs()

            if (statusData.status === 'completed' && statusData.output_video_path) {
              clearInterval(renderPollTimer)
              renderPollTimer = null
              get().fetchLogs()
              const finalUrl = toMediaUrl(statusData.output_video_path)
              set(s => {
                s.isRendering = false
                s.renderedVideoUrl = finalUrl
                s.renderProgress = 100
                s.renderStage = '100% — Ready to download and preview'
              })
              toast.success('🎉 Video render completed!')
            } else if (statusData.status === 'failed') {
              clearInterval(renderPollTimer)
              renderPollTimer = null
              get().fetchLogs()
              set(s => {
                s.isRendering = false
                s.renderStage = `Failed: ${statusData.error_message || 'Rendering error'}`
              })
              toast.error(`Render failed: ${statusData.error_message || 'Unknown error'}`)
            }
          } catch (e) {
            // Ignore temporary poll network drops
          }
        }, 1500)
      } catch (err: any) {
        if (renderPollTimer) {
          clearInterval(renderPollTimer)
          renderPollTimer = null
        }
        set(s => { s.isRendering = false })
        toast.error(`Render error: ${err.message}`)
      }
    },

    cancelRender: async () => {
      if (renderPollTimer) {
        clearInterval(renderPollTimer)
        renderPollTimer = null
      }
      const proj = get().project
      const projectId = proj?.project_id
      if (projectId) {
        try {
          await fetch(`/api/cancel-render/${projectId}`, { method: 'POST' })
        } catch (e) {
          console.warn('Cancel render request failed:', e)
        }
      }
      set(s => {
        s.isRendering = false
        s.renderProgress = 0
        s.renderStage = 'Render cancelled by user'
      })
      toast('Export render cancelled', { icon: '🛑' })
      get().fetchLogs()
    },

    fetchLogs: async () => {
      try {
        const lastId = get().lastLogId
        const resp = await fetch(`/api/system-logs?since_id=${lastId}&limit=150`)
        if (!resp.ok) return
        const data = await resp.json()
        if (data.logs && data.logs.length > 0) {
          set(s => {
            const existingIds = new Set(s.logs.map(l => l.id))
            const fresh = data.logs.filter((l: any) => !existingIds.has(l.id))
            if (fresh.length > 0) {
              s.logs = [...s.logs, ...fresh].slice(-600)
            }
            s.lastLogId = data.latest_id || data.last_id || (fresh[fresh.length - 1]?.id ?? s.lastLogId)
          })
        }
      } catch (e) {
        // Backend logging fetch error silent
      }
    },

    clearLogs: async () => {
      try {
        await fetch('/api/system-logs/clear', { method: 'POST' })
        set(s => {
          s.logs = []
          s.lastLogId = 0
        })
        toast.success('System logs cleared')
      } catch (e: any) {
        toast.error(`Failed to clear logs: ${e.message}`)
      }
    },
  }))
)
