import React, { useRef, useEffect, useMemo } from 'react'
import { usePlayerStore } from '@/store/usePlayerStore'
import { useUIStore } from '@/store/useUIStore'
import { useAIProjectStore, toMediaUrl } from '@/store/useAIProjectStore'
import { useTimelineStore } from '@/store/useTimelineStore'
import { useMediaStore } from '@/store/useMediaStore'
import { CanvasOverlay } from './CanvasOverlay'
import { PlayerControls } from './PlayerControls'
import type { VideoClip, AudioClip, ColorFilters } from '@/types/clip'
import { DEFAULT_COLOR_FILTERS } from '@/types/clip'
import styles from './PreviewPlayer.module.css'

function isMediaVideo(src?: string | null, name?: string | null): boolean {
  if (!src) return false
  const asset = useMediaStore.getState().assets.find(a => a.src === src)
  if (asset) return asset.type === 'video'
  const combined = `${src} ${name || ''}`.toLowerCase()
  if (/\.(jpe?g|png|webp|gif|svg|bmp|avif)(\b|\?|$)/i.test(combined)) return false
  if (/\.(mp4|webm|mov|mkv|ogg|m4v|avi|flv)(\b|\?|$)/i.test(combined)) return true
  if (src.startsWith('blob:')) return true
  return false
}

function getCssFilter(filters?: ColorFilters, effect?: string): string {
  const parts: string[] = []
  if (filters) {
    if (filters.brightness) parts.push(`brightness(${1 + filters.brightness / 100})`)
    if (filters.contrast) parts.push(`contrast(${1 + filters.contrast / 100})`)
    if (filters.saturation) parts.push(`saturate(${1 + filters.saturation / 100})`)
    if (filters.hue) parts.push(`hue-rotate(${filters.hue}deg)`)
    if (filters.temperature) {
      if (filters.temperature > 0) parts.push(`sepia(${filters.temperature / 200})`)
      else parts.push(`hue-rotate(${filters.temperature * 0.5}deg)`)
    }

    if (filters.preset === 'cinematic') parts.push('contrast(1.15) saturate(1.1) brightness(0.95)')
    else if (filters.preset === 'news') parts.push('contrast(1.1) saturate(1.2) brightness(1.05)')
    else if (filters.preset === 'warm') parts.push('sepia(0.35) saturate(1.25)')
    else if (filters.preset === 'film') parts.push('contrast(1.2) brightness(0.9) saturate(0.85)')
    else if (filters.preset === 'bw') parts.push('grayscale(1) contrast(1.15)')
    else if (filters.preset === 'vintage') parts.push('sepia(0.5) contrast(0.9) brightness(0.95)')
  }
  if (effect === 'Blur') parts.push('blur(4px)')
  else if (effect === 'Sharpen') parts.push('contrast(1.4) brightness(1.05)')
  else if (effect === 'Glow') parts.push('brightness(1.15) contrast(1.1) drop-shadow(0 0 10px rgba(255,255,255,0.7))')
  else if (effect === 'Vignette') parts.push('contrast(1.25)')

  return parts.length > 0 ? parts.join(' ') : 'none'
}

function getMotionTransform(motionStyle: string = 'zoom_in', progress: number): string {
  const p = Math.min(1, Math.max(0, progress))
  switch (motionStyle) {
    case 'zoom_out': {
      const s = 1.15 - 0.15 * p
      return `scale(${s.toFixed(4)})`
    }
    case 'pan_left': {
      const x = 3 - 6 * p
      return `scale(1.12) translateX(${x.toFixed(2)}%)`
    }
    case 'pan_right': {
      const x = -3 + 6 * p
      return `scale(1.12) translateX(${x.toFixed(2)}%)`
    }
    case 'static': {
      return 'scale(1.0)'
    }
    case 'zoom_in':
    default: {
      const s = 1.00 + 0.15 * p
      return `scale(${s.toFixed(4)})`
    }
  }
}

interface TransitionStylesResult {
  outgoingStyle: React.CSSProperties
  incomingStyle: React.CSSProperties
  flashOverlay: { active: boolean; color: string; opacity: number }
}

function getTransitionStyles(
  type: string,
  progress: number,
  outgoingTransform: string,
  incomingTransform: string
): TransitionStylesResult {
  const p = Math.min(1, Math.max(0, progress))
  const norm = (type || 'fade').toLowerCase().replace(/[-_]/g, '')

  let outgoingStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: outgoingTransform,
    zIndex: 1,
  }

  let incomingStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: incomingTransform,
    zIndex: 2,
  }

  let flashOverlay = {
    active: false,
    color: '#000000',
    opacity: 0,
  }

  switch (norm) {
    case 'wipeleft': {
      incomingStyle.clipPath = `inset(0 0 0 ${((1 - p) * 100).toFixed(2)}%)`
      break
    }
    case 'wiperight': {
      incomingStyle.clipPath = `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`
      break
    }
    case 'wipeup': {
      incomingStyle.clipPath = `inset(${((1 - p) * 100).toFixed(2)}% 0 0 0)`
      break
    }
    case 'wipedown': {
      incomingStyle.clipPath = `inset(0 0 ${((1 - p) * 100).toFixed(2)}% 0)`
      break
    }
    case 'slideleft': {
      outgoingStyle.transform = `translateX(${(-p * 100).toFixed(2)}%) ${outgoingTransform}`
      incomingStyle.transform = `translateX(${((1 - p) * 100).toFixed(2)}%) ${incomingTransform}`
      break
    }
    case 'slideright': {
      outgoingStyle.transform = `translateX(${(p * 100).toFixed(2)}%) ${outgoingTransform}`
      incomingStyle.transform = `translateX(${(-(1 - p) * 100).toFixed(2)}%) ${incomingTransform}`
      break
    }
    case 'circlecrop':
    case 'circleiris': {
      incomingStyle.clipPath = `circle(${(p * 140).toFixed(1)}% at center)`
      break
    }
    case 'rectcrop': {
      const pad = (1 - p) * 50
      incomingStyle.clipPath = `inset(${pad.toFixed(1)}% ${pad.toFixed(1)}% ${pad.toFixed(1)}% ${pad.toFixed(1)}%)`
      break
    }
    case 'zoomin': {
      outgoingStyle.opacity = 1 - p * 0.5
      incomingStyle.opacity = p
      incomingStyle.transform = `scale(${(0.75 + p * 0.25).toFixed(3)}) ${incomingTransform}`
      break
    }
    case 'zoomout': {
      outgoingStyle.opacity = 1 - p
      outgoingStyle.transform = `scale(${(1 - p * 0.2).toFixed(3)}) ${outgoingTransform}`
      incomingStyle.opacity = p
      break
    }
    case 'fadeblack': {
      if (p < 0.5) {
        outgoingStyle.opacity = 1 - p * 2
        incomingStyle.opacity = 0
      } else {
        outgoingStyle.opacity = 0
        incomingStyle.opacity = (p - 0.5) * 2
      }
      break
    }
    case 'fadewhite': {
      const flash = p < 0.5 ? p * 2 : (1 - p) * 2
      flashOverlay = { active: true, color: '#ffffff', opacity: flash }
      if (p < 0.5) {
        outgoingStyle.opacity = 1
        incomingStyle.opacity = 0
      } else {
        outgoingStyle.opacity = 0
        incomingStyle.opacity = 1
      }
      break
    }
    case 'dissolve':
    case 'fade':
    default: {
      outgoingStyle.opacity = 1
      incomingStyle.opacity = p
      break
    }
  }

  return { outgoingStyle, incomingStyle, flashOverlay }
}

interface VisualItem {
  id: string | number
  src: string
  isVideo: boolean
  startTime: number
  endTime: number
  duration: number
  motionStyle: string
  filters?: ColorFilters
  effect?: string
  opacity: number
  transitionType: string
  transitionDuration: number
}

export function PreviewPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const musicRef = useRef<HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const currentAudioSrcRef = useRef<string | null>(null)
  const currentMusicSrcRef = useRef<string | null>(null)
  const currentVideoSrcRef = useRef<string | null>(null)
  const activeAudioRef = useRef<{ src: string; startTime: number; fileStart: number } | null>(null)
  const activeMusicRef = useRef<{ src: string; startTime: number; fileStart: number; volume: number } | null>(null)

  const {
    currentTime, duration, isPlaying, volume, isMuted, playbackRate,
    setVideoRef, setCurrentTime,
    loop, loopStart,
  } = usePlayerStore()

  const { showSafeZones } = useUIStore()
  const { project, aspectRatio, activeSceneId, setActiveSceneId } = useAIProjectStore()
  const { timeline, selectedClipIds } = useTimelineStore()
  const { selectedAssetId, assets } = useMediaStore()

  // Register video ref in store
  useEffect(() => {
    setVideoRef(videoRef.current)
    return () => setVideoRef(null)
  }, [setVideoRef])

  // Sync timeline or project duration to player store
  useEffect(() => {
    const maxDur = Math.max(timeline.duration || 0, project?.total_timeline_duration || 0)
    if (maxDur > 0 && maxDur !== duration) {
      usePlayerStore.getState().setDuration(maxDur)
    }
  }, [timeline.duration, project?.total_timeline_duration, duration])

  // Find active AI scene at currentTime
  const activeScene = useMemo(() => {
    if (!project || !project.scenes || project.scenes.length === 0) return null
    return project.scenes.find(
      (s) => currentTime >= (s.timeline_start || 0) && currentTime < (s.timeline_end || 3)
    ) || project.scenes[project.scenes.length - 1] || null
  }, [project, currentTime])

  // Sync activeSceneId when playing/seeking
  useEffect(() => {
    if (activeScene && activeScene.scene_id !== activeSceneId) {
      setActiveSceneId(activeScene.scene_id)
    }
  }, [activeScene, activeSceneId, setActiveSceneId])

  // Active video clip from timeline
  const activeTimelineVideoClip = useMemo(() => {
    const vTrack = timeline.tracks.find((t) => t.type === 'video')
    if (!vTrack) return null
    return (vTrack.clips as VideoClip[]).find(
      (c) => currentTime >= c.startTime && currentTime < c.startTime + c.duration
    ) || null
  }, [timeline.tracks, currentTime])

  // Selected clip if any (to reflect properties and preview changes live)
  const selectedVideoClip = useMemo(() => {
    if (selectedClipIds.length !== 1) return null
    return timeline.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipIds[0]) as VideoClip | undefined
  }, [timeline.tracks, selectedClipIds])

  const currentVideoClip = activeTimelineVideoClip || (selectedVideoClip?.type === 'video' ? selectedVideoClip : null)

  // Extract continuous visual sequence across timeline or AI project scenes
  const visualSequence = useMemo<VisualItem[]>(() => {
    const vTracks = timeline.tracks.filter((t) => t.type === 'video' && t.visible !== false)
    const clips = vTracks.flatMap(t => t.clips as VideoClip[]).sort((a, b) => a.startTime - b.startTime)

    if (clips.length > 0) {
      return clips.map((c, idx) => {
        const isVideo = isMediaVideo(c.src, c.name)
        const transType = c.transition?.type || project?.default_transition || 'fade'
        const transDur = c.transition?.duration ?? project?.transition_duration ?? 0.5
        const motion = c.motion || (project?.scenes?.[idx]?.motion_style) || 'zoom_in'
        return {
          id: c.id,
          src: c.src,
          isVideo,
          startTime: c.startTime,
          endTime: c.startTime + c.duration,
          duration: Math.max(0.1, c.duration),
          motionStyle: motion,
          filters: c.filters,
          effect: c.effect,
          opacity: c.opacity ?? 1,
          transitionType: transType,
          transitionDuration: transDur,
        }
      })
    }

    if (project?.scenes && project.scenes.length > 0) {
      const maxShotDur = Math.max(1.5, project.max_shot_duration || 3.0)
      const items: VisualItem[] = []
      project.scenes.forEach((s) => {
        const sceneImages: string[] = []
        if (s.all_media_paths && s.all_media_paths.length > 0) {
          s.all_media_paths.forEach(p => {
            const u = toMediaUrl(p)
            if (u && !sceneImages.includes(u)) sceneImages.push(u)
          })
        }
        let prim = toMediaUrl(s.local_media_path)
        if (!prim && s.selected_visual) {
          prim = s.selected_visual.image_url || s.selected_visual.thumbnail_url
        }
        if (prim && !sceneImages.includes(prim)) sceneImages.unshift(prim)
        if (sceneImages.length === 0) sceneImages.push(prim || '')

        const st = s.timeline_start || 0
        const en = s.timeline_end && s.timeline_end > st ? s.timeline_end : st + (s.audio_duration || 3)
        const sceneDur = Math.max(0.1, en - st)

        const threshold = maxShotDur * 0.5
        const fullShots = Math.floor(sceneDur / maxShotDur)
        const remainder = Math.round((sceneDur - (fullShots * maxShotDur)) * 1000) / 1000

        let shotDurations: number[] = []
        if (sceneDur > maxShotDur) {
          if (remainder >= threshold) {
            shotDurations = Array(fullShots).fill(maxShotDur).concat([remainder])
          } else {
            if (fullShots > 1) {
              shotDurations = Array(fullShots - 1).fill(maxShotDur).concat([Math.round((maxShotDur + remainder) * 1000) / 1000])
            } else {
              shotDurations = [sceneDur]
            }
          }
        } else {
          shotDurations = [sceneDur]
        }
        const numSubShots = shotDurations.length
        const motionCycle: Array<'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right'> = [
          (s.motion_style as any) || 'zoom_in',
          'zoom_out',
          'pan_left',
          'pan_right',
        ]

        let curSubStart = st
        for (let k = 0; k < numSubShots; k++) {
          const subDur = shotDurations[k]
          const subStart = curSubStart
          const subEnd = (k === numSubShots - 1) ? en : subStart + subDur
          curSubStart = subEnd
          // Pick next distinct image for each cut
          const img = (s.all_media_paths && s.all_media_paths[k])
            ? toMediaUrl(s.all_media_paths[k])
            : (sceneImages[k] || sceneImages[k % sceneImages.length])
          items.push({
            id: `${s.scene_id}-${k}`,
            src: img,
            isVideo: isMediaVideo(img),
            startTime: subStart,
            endTime: subEnd,
            duration: Math.max(0.1, subEnd - subStart),
            motionStyle: motionCycle[k % motionCycle.length],
            filters: DEFAULT_COLOR_FILTERS,
            effect: undefined,
            opacity: 1,
            transitionType: s.transition_type || project.default_transition || 'fade',
            transitionDuration: s.transition_duration || project.transition_duration || 0.5,
          })
        }
      })
      return items
    }

    if (selectedAssetId) {
      const sel = assets.find((a) => a.id === selectedAssetId)
      if (sel?.src) {
        return [
          {
            id: sel.id,
            src: sel.src,
            isVideo: sel.type === 'video',
            startTime: 0,
            endTime: 10,
            duration: 10,
            motionStyle: 'static',
            filters: undefined,
            effect: undefined,
            opacity: 1,
            transitionType: 'fade',
            transitionDuration: 0.5,
          },
        ]
      }
    }

    return []
  }, [timeline.tracks, project?.scenes, project?.default_transition, project?.transition_duration, selectedAssetId, assets])

  // Determine transition window between consecutive scenes/shots
  const activeVisualState = useMemo(() => {
    if (visualSequence.length === 0) return null

    for (let i = 0; i < visualSequence.length - 1; i++) {
      const itemA = visualSequence[i]
      const itemB = visualSequence[i + 1]
      const rawDur = itemA.transitionDuration || 0.5
      const tdur = Math.min(rawDur, itemA.duration * 0.45, itemB.duration * 0.45)
      const transStart = itemA.endTime - tdur
      const transEnd = itemA.endTime

      if (currentTime >= transStart && currentTime < transEnd) {
        const progress = Math.min(1, Math.max(0, (currentTime - transStart) / tdur))
        return {
          isTransitioning: true,
          type: itemA.transitionType || 'fade',
          progress,
          outgoing: itemA,
          incoming: itemB,
        }
      }
    }

    let activeItem = visualSequence.find(
      (item) => currentTime >= item.startTime && currentTime <= item.endTime
    )
    if (!activeItem) {
      if (currentTime >= (visualSequence[visualSequence.length - 1]?.endTime || 0)) {
        activeItem = visualSequence[visualSequence.length - 1]
      } else {
        activeItem = visualSequence[0]
      }
    }

    return {
      isTransitioning: false,
      active: activeItem,
    }
  }, [visualSequence, currentTime])

  // Active visual (video vs image) for master video/audio synchronization
  const activeVisual = useMemo(() => {
    if (activeVisualState?.isTransitioning) {
      return activeVisualState.outgoing || null
    }
    return activeVisualState?.active || null
  }, [activeVisualState])

  // Active audio clip from timeline or active scene TTS
  const activeAudio = useMemo(() => {
    const aTrack = timeline.tracks.find((t) => t.type === 'audio' && t.id !== 'track-custom-audio' && !t.name.toLowerCase().includes('custom'))
      || timeline.tracks.find((t) => t.type === 'audio')
    const customTrack = timeline.tracks.find(
      (t) => (t.id === 'track-custom-audio' || t.name.toLowerCase().includes('custom')) && t.type === 'audio'
    )

    if (aTrack && !aTrack.muted && aTrack.clips.length > 0) {
      const sorted = (aTrack.clips as AudioClip[]).filter((c) => !c.muted && c.src)
      const clip = sorted.find(
        (c) => currentTime >= c.startTime - 0.04 && currentTime < c.startTime + c.duration - 0.01
      ) || sorted.find(
        (c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration
      )
      if (clip && clip.src) return { src: clip.src, startTime: clip.startTime, fileStart: clip.fileStart || 0 }
    }

    if (customTrack && !customTrack.muted && customTrack.clips.length > 0) {
      const sorted = (customTrack.clips as AudioClip[]).filter((c) => !c.muted && c.src)
      const clip = sorted.find(
        (c) => currentTime >= c.startTime - 0.04 && currentTime < c.startTime + c.duration - 0.01
      ) || sorted.find(
        (c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration
      )
      if (clip && clip.src) return { src: clip.src, startTime: clip.startTime, fileStart: clip.fileStart || 0 }
    }
    if (activeScene?.local_audio_path) {
      const normScAudio = toMediaUrl(activeScene.local_audio_path)
      const normProjMaster = project?.master_audio_path ? toMediaUrl(project.master_audio_path) : ''
      const isMasterAudio = Boolean(
        (normProjMaster && normScAudio === normProjMaster) ||
        normScAudio.includes('master_narration') ||
        normScAudio.includes('master_audio')
      )
      return {
        src: normScAudio,
        startTime: activeScene.timeline_start || 0,
        fileStart: isMasterAudio ? (activeScene.timeline_start || 0) : 0,
      }
    }
    return null
  }, [timeline.tracks, currentTime, activeScene, project?.master_audio_path])

  // Active music clip from timeline
  const activeMusic = useMemo(() => {
    const mTrack = timeline.tracks.find((t) => t.type === 'music')
    if (mTrack?.muted) return null

    if (mTrack && mTrack.clips.length > 0) {
      const clip = (mTrack.clips as AudioClip[]).find(
        (c) => !c.muted && currentTime >= c.startTime && currentTime < c.startTime + c.duration
      )
      if (clip && clip.src) {
        return {
          src: clip.src,
          startTime: clip.startTime,
          fileStart: clip.fileStart || 0,
          volume: Math.min(1, Math.max(0, (clip.volume ?? 1) * (mTrack.volume ?? 1))),
        }
      }
    }
    return null
  }, [timeline.tracks, currentTime])

  // Update latest refs for 60fps tick clock
  activeAudioRef.current = activeAudio
  activeMusicRef.current = activeMusic

  // Audio: sync source smoothly without disruptive a.load() resetting audio session
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const newSrc = activeAudio?.src || null

    if (currentAudioSrcRef.current !== newSrc) {
      currentAudioSrcRef.current = newSrc
      if (newSrc) {
        const wasPlaying = usePlayerStore.getState().isPlaying
        a.src = newSrc
        const offset = Math.max(0, (usePlayerStore.getState().currentTime - (activeAudio?.startTime || 0)) + (activeAudio?.fileStart || 0))
        try { a.currentTime = offset } catch (_) {}
        if (wasPlaying && !a.muted) {
          a.play().catch(() => {})
        }
        const onCanPlay = () => {
          const cur = activeAudioRef.current
          if (!cur) return
          const curOffset = Math.max(0, (usePlayerStore.getState().currentTime - cur.startTime) + cur.fileStart)
          try { a.currentTime = curOffset } catch (_) {}
          if (usePlayerStore.getState().isPlaying && !a.muted && a.paused) {
            a.play().catch(() => {})
          }
        }
        a.addEventListener('canplay', onCanPlay, { once: true })
      } else {
        a.pause()
        a.removeAttribute('src')
      }
    }
  }, [activeAudio?.src])

  // Music: sync source only on actual change and listen for canplay
  useEffect(() => {
    const m = musicRef.current
    if (!m) return
    const newSrc = activeMusic?.src || null

    if (currentMusicSrcRef.current !== newSrc) {
      currentMusicSrcRef.current = newSrc
      if (newSrc) {
        m.src = newSrc
        m.load()
        const onCanPlay = () => {
          const cur = activeMusicRef.current
          if (!cur) return
          const offset = Math.max(0, (usePlayerStore.getState().currentTime - cur.startTime) + cur.fileStart)
          try { m.currentTime = offset } catch (_) {}
          if (usePlayerStore.getState().isPlaying && !m.muted) {
            m.play().catch(() => {})
          }
        }
        if (m.readyState >= 2) {
          onCanPlay()
        } else {
          m.addEventListener('canplay', onCanPlay, { once: true })
        }
      } else {
        m.pause()
        m.removeAttribute('src')
        m.load()
      }
    }
  }, [activeMusic?.src])

  // Audio: sync volume, mute, and immediately resume playing on un-mute
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const aTrack = timeline.tracks.find((t) => t.type === 'audio' && t.id !== 'track-custom-audio' && !t.name.toLowerCase().includes('custom'))
      || timeline.tracks.find((t) => t.type === 'audio')
    const customTrack = timeline.tracks.find(
      (t) => (t.id === 'track-custom-audio' || t.name.toLowerCase().includes('custom')) && t.type === 'audio'
    )
    const isCustomActive = activeAudio && customTrack?.clips.some(c => c.src === activeAudio.src)
    const activeTrack = isCustomActive ? customTrack : aTrack
    const finalMuted = isMuted || !!activeTrack?.muted
    a.muted = finalMuted
    a.volume = finalMuted ? 0 : Math.min(1, Math.max(0, volume * (activeTrack?.volume ?? 1)))
    a.playbackRate = playbackRate

    // If unmuted while playing, immediately resume sound!
    if (!finalMuted && isPlaying && a.paused && a.src && a.readyState >= 2) {
      a.play().catch(() => {})
    }
  }, [volume, isMuted, playbackRate, timeline.tracks, isPlaying])

  // Music: sync volume, mute, and immediately resume playing on un-mute
  useEffect(() => {
    const m = musicRef.current
    if (!m) return
    const mTrack = timeline.tracks.find((t) => t.type === 'music')
    const finalMuted = isMuted || !!mTrack?.muted
    m.muted = finalMuted
    const baseVol = activeMusic?.volume ?? 1.0
    m.volume = finalMuted ? 0 : Math.min(1, Math.max(0, volume * baseVol))

    // If unmuted while playing, immediately resume sound!
    if (!finalMuted && isPlaying && m.paused && m.src && m.readyState >= 2) {
      m.play().catch(() => {})
    }
  }, [volume, isMuted, activeMusic?.volume, timeline.tracks, isPlaying])

  // Audio & Music: transport play/pause toggle
  useEffect(() => {
    const a = audioRef.current
    const m = musicRef.current
    if (isPlaying) {
      if (a && a.src) {
        const cur = activeAudioRef.current
        if (cur) {
          const offset = Math.max(0, (currentTime - cur.startTime) + cur.fileStart)
          if (Math.abs(a.currentTime - offset) > 0.15) {
            try { a.currentTime = offset } catch (_) {}
          }
        }
        if (!a.muted) a.play().catch(() => {})
      }
      if (m && m.src && !m.muted) {
        const curM = activeMusicRef.current
        if (curM) {
          const offset = Math.max(0, (currentTime - curM.startTime) + curM.fileStart)
          if (Math.abs(m.currentTime - offset) > 0.2) {
            try { m.currentTime = offset } catch (_) {}
          }
        }
        m.play().catch(() => {})
      }
    } else {
      if (a) a.pause()
      if (m) m.pause()
    }
  }, [isPlaying])

  // Audio & Music: manual scrub/seek adjustment when paused
  useEffect(() => {
    if (isPlaying) return // Synchronized continuously during rAF tick
    const a = audioRef.current
    if (a && a.src && activeAudio) {
      const offset = Math.max(0, (currentTime - activeAudio.startTime) + activeAudio.fileStart)
      try { a.currentTime = offset } catch (_) {}
    }
    const m = musicRef.current
    if (m && m.src && activeMusic) {
      const offset = Math.max(0, (currentTime - activeMusic.startTime) + activeMusic.fileStart)
      try { m.currentTime = offset } catch (_) {}
    }
  }, [currentTime, activeAudio, activeMusic, isPlaying])



  // Video: sync source only on actual change
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const newSrc = (activeVisual?.isVideo && activeVisual.src) ? activeVisual.src : null

    if (currentVideoSrcRef.current !== newSrc) {
      currentVideoSrcRef.current = newSrc
      if (newSrc) {
        v.src = newSrc
        const offset = Math.max(0, currentTime - (activeVisual?.startTime || 0))
        v.currentTime = offset
        if (isPlaying) {
          v.play().catch(() => {})
        }
      } else {
        v.pause()
        v.removeAttribute('src')
        v.load()
      }
    }
  }, [activeVisual?.isVideo, activeVisual?.src])

  // Video: sync play/pause
  useEffect(() => {
    const v = videoRef.current
    if (!v || !currentVideoSrcRef.current) return
    if (isPlaying) {
      const offset = Math.max(0, currentTime - (activeVisual?.startTime || 0))
      if (Math.abs(v.currentTime - offset) > 0.3) {
        v.currentTime = offset
      }
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [isPlaying])

  // Video: sync volume and playback rate
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = isMuted ? 0 : Math.min(1, volume)
    const clipSpeed = currentVideoClip?.speed ?? 1
    v.playbackRate = Math.max(0.1, playbackRate * clipSpeed)
  }, [volume, isMuted, playbackRate, currentVideoClip?.speed])

  // Video: seek / drift adjustment
  useEffect(() => {
    const v = videoRef.current
    if (!v || !currentVideoSrcRef.current || !activeVisual?.isVideo) return
    const offset = Math.max(0, currentTime - activeVisual.startTime)
    if (Math.abs(v.currentTime - offset) > 0.35) {
      v.currentTime = offset
    }
  }, [currentTime, activeVisual])

  // Smooth Master Playback Clock (rAF)
  useEffect(() => {
    if (!isPlaying) return

    let lastTime = performance.now()

    const tick = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      const state = usePlayerStore.getState()
      const tlDur = useTimelineStore.getState().timeline?.duration || 0
      const totalDur = Math.max(state.duration || 0, tlDur, project?.total_timeline_duration || 0, 10)
      let nextTime = state.currentTime + delta * state.playbackRate

      if (nextTime >= totalDur) {
        if (state.loop) {
          nextTime = state.loopStart ?? 0
          state.seek(nextTime)
        } else {
          nextTime = totalDur
          state.setCurrentTime(nextTime)
          state.pause()
          return
        }
      } else {
        state.setCurrentTime(nextTime)
      }

      // Continuous audio synchronization across consecutive scenes
      const a = audioRef.current
      const curAud = activeAudioRef.current
      if (a && curAud && a.src && !a.muted) {
        const targetOffset = Math.max(0, (nextTime - curAud.startTime) + curAud.fileStart)
        if (a.paused && a.readyState >= 1) {
          a.play().catch(() => {})
        }
        if (Math.abs(a.currentTime - targetOffset) > 0.25) {
          try { a.currentTime = targetOffset } catch (_) {}
        }
      }

      const m = musicRef.current
      const curMus = activeMusicRef.current
      if (m && curMus && m.src && !m.muted) {
        const targetMusicOffset = Math.max(0, (nextTime - curMus.startTime) + curMus.fileStart)
        if (m.paused && m.readyState >= 2) {
          m.play().catch(() => {})
        }
        if (Math.abs(m.currentTime - targetMusicOffset) > 0.35) {
          try { m.currentTime = targetMusicOffset } catch (_) {}
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [isPlaying, project?.total_timeline_duration])

  const isVertical = aspectRatio === '9:16' || project?.aspect_ratio === '9:16'

  return (
    <div className={styles.playerWrapper}>
      {/* Hidden audio element for synchronizing narration playback */}
      <audio ref={audioRef} preload="auto" />
      {/* Hidden audio element for background ambient music */}
      <audio ref={musicRef} preload="auto" loop onError={() => {}} />

      {/* Preview Stage */}
      <div className={styles.stage}>
        <div
          className={`${styles.videoContainer} ${isVertical ? styles.vertical : ''}`}
          ref={containerRef}
        >
          {/* Stable Media Layer: video element always stays mounted to keep videoRef and events active */}
          <div className={styles.mediaLayer}>
            <video
              ref={videoRef}
              src={activeVisual?.isVideo ? activeVisual.src : undefined}
              className={styles.video}
              style={{
                display: activeVisual?.isVideo && !activeVisualState?.isTransitioning ? 'block' : 'none',
                filter: getCssFilter(activeVisual?.filters, activeVisual?.effect),
                opacity: activeVisual?.opacity ?? 1,
                transform: activeVisual
                  ? getMotionTransform(
                      activeVisual.motionStyle,
                      (currentTime - activeVisual.startTime) / activeVisual.duration
                    )
                  : undefined,
              }}
              playsInline
              preload="metadata"
            />

            {/* Live Real-time Transition Between Scenes */}
            {activeVisualState?.isTransitioning && activeVisualState.outgoing && activeVisualState.incoming && (() => {
              const { outgoing, incoming, progress, type } = activeVisualState
              const outProgress = Math.min(1, Math.max(0, (currentTime - outgoing.startTime) / outgoing.duration))
              const inProgress = Math.min(1, Math.max(0, (currentTime - incoming.startTime) / incoming.duration))
              const outMotion = getMotionTransform(outgoing.motionStyle, outProgress)
              const inMotion = getMotionTransform(incoming.motionStyle, inProgress)
              const outFilter = getCssFilter(outgoing.filters, outgoing.effect)
              const inFilter = getCssFilter(incoming.filters, incoming.effect)

              const { outgoingStyle, incomingStyle, flashOverlay } = getTransitionStyles(
                type,
                progress,
                outMotion,
                inMotion
              )

              return (
                <div className={styles.transitionContainer}>
                  {/* Outgoing Scene */}
                  <div className={styles.transLayer} style={outgoingStyle}>
                    {outgoing.isVideo ? (
                      <video
                        src={outgoing.src}
                        className={styles.video}
                        style={{ filter: outFilter, opacity: outgoing.opacity }}
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={outgoing.src}
                        alt="Outgoing scene"
                        className={styles.imagePreview}
                        style={{ filter: outFilter, opacity: outgoing.opacity }}
                      />
                    )}
                  </div>

                  {/* Incoming Scene */}
                  <div className={styles.transLayer} style={incomingStyle}>
                    {incoming.isVideo ? (
                      <video
                        src={incoming.src}
                        className={styles.video}
                        style={{ filter: inFilter, opacity: incoming.opacity }}
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={incoming.src}
                        alt="Incoming scene"
                        className={styles.imagePreview}
                        style={{ filter: inFilter, opacity: incoming.opacity }}
                      />
                    )}
                  </div>

                  {/* Flash effect overlay if any */}
                  {flashOverlay.active && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: flashOverlay.color,
                        opacity: flashOverlay.opacity,
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Live Transition Indicator Pill */}
                  <div className={styles.transIndicatorPill}>
                    <span>⚡ {type} ({(progress * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              )
            })()}

            {/* Normal Single Scene Visual (when not in transition) with real-time Ken Burns motion */}
            {!activeVisualState?.isTransitioning && activeVisual && !activeVisual.isVideo && activeVisual.src && (() => {
              const itemProgress = Math.min(
                1,
                Math.max(0, (currentTime - activeVisual.startTime) / activeVisual.duration)
              )
              const motionTransform = getMotionTransform(activeVisual.motionStyle, itemProgress)
              const cssFilter = getCssFilter(activeVisual.filters, activeVisual.effect)

              return (
                <img
                  key={activeVisual.id || activeVisual.src}
                  src={activeVisual.src}
                  alt="Scene preview"
                  className={styles.imagePreview}
                  style={{
                    filter: cssFilter,
                    opacity: activeVisual.opacity,
                    transform: motionTransform,
                  }}
                />
              )
            })()}
          </div>

          {/* Lower Third News Banner */}
          {activeScene && (activeScene.lower_third_headline || activeScene.category_tag) && (
            <div className={styles.lowerThird}>
              {activeScene.category_tag && (
                <span className={styles.lowerThirdTag}>
                  {activeScene.category_tag}
                </span>
              )}
              {activeScene.lower_third_headline && (
                <div className={styles.lowerThirdHeadline}>
                  {activeScene.lower_third_headline}
                </div>
              )}
            </div>
          )}

          {/* Subtitles Overlay */}
          {activeScene && activeScene.narration_text && (
            <div className={styles.subtitleOverlay}>
              <span className={styles.subtitleText}>
                {activeScene.narration_text}
              </span>
            </div>
          )}

          {/* Watermark Scene Indicator */}
          {activeScene && project && (
            <div className={styles.sceneBadge}>
              <span>🎬</span>
              <span>
                Scene {activeScene.scene_id} / {project.scenes.length}
              </span>
            </div>
          )}

          {/* Fabric.js Canvas Overlay — isolated inside its own container */}
          <CanvasOverlay videoRef={videoRef} containerRef={containerRef} />

          {/* Safe Zone Guides */}
          {showSafeZones && (
            <div className={styles.safeZones}>
              <div className={styles.safeTitle} title="Title Safe (80%)" />
              <div className={styles.safeAction} title="Action Safe (90%)" />
            </div>
          )}

          {/* Empty state when no media */}
          {!activeVisual?.src && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🎬</div>
              <p>AI Video Studio Monitor</p>
              <p className={styles.emptyHint}>Generate an AI script or drop media to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <PlayerControls />
    </div>
  )
}
