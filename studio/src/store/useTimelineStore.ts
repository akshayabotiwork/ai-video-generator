import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import { usePlayerStore } from './usePlayerStore'
import type { Timeline, Track, TrackType } from '@/types/track'
import type { Clip, VideoClip, AudioClip, OverlayClip } from '@/types/clip'
import type { HistoryEntry } from '@/types/project'
import { DEFAULT_TRACK_HEIGHTS, TRACK_COLORS } from '@/types/track'

// nanoid for unique IDs
function uid() { return nanoid(10) }

// ============================================================
// DEFAULT TIMELINE
// ============================================================
function createDefaultTimeline(): Timeline {
  const videoTrack: Track = {
    id: uid(), type: 'video', name: 'V1', clips: [],
    locked: false, visible: true, muted: false, solo: false,
    volume: 1, color: TRACK_COLORS.video, height: DEFAULT_TRACK_HEIGHTS.video,
  }
  const audioTrack: Track = {
    id: uid(), type: 'audio', name: 'A1', clips: [],
    locked: false, visible: true, muted: false, solo: false,
    volume: 1, color: TRACK_COLORS.audio, height: DEFAULT_TRACK_HEIGHTS.audio,
  }
  const customAudioTrack: Track = {
    id: 'track-custom-audio', type: 'audio', name: 'Custom Audio', clips: [],
    locked: false, visible: true, muted: false, solo: false,
    volume: 1, color: '#06B6D4', height: DEFAULT_TRACK_HEIGHTS.audio,
  }
  const musicTrack: Track = {
    id: uid(), type: 'music', name: 'Music', clips: [],
    locked: false, visible: true, muted: false, solo: false,
    volume: 1, color: TRACK_COLORS.music, height: DEFAULT_TRACK_HEIGHTS.music,
  }
  const overlayTrack: Track = {
    id: uid(), type: 'overlay', name: 'Overlays', clips: [],
    locked: false, visible: true, muted: false, solo: false,
    volume: 1, color: TRACK_COLORS.overlay, height: DEFAULT_TRACK_HEIGHTS.overlay,
  }
  return {
    tracks: [videoTrack, audioTrack, customAudioTrack, musicTrack, overlayTrack],
    duration: 0,
    zoom: 80,       // 80px per second
    scrollX: 0,
    snapEnabled: true,
    markers: [],
    inPoint: undefined,
    outPoint: undefined,
  }
}

export function ensureCustomAudioTrack(tracks: Track[]): Track[] {
  const hasCustom = tracks.some(t => t.id === 'track-custom-audio' || t.name.toLowerCase().includes('custom audio'))
  if (hasCustom) return tracks

  const musicIndex = tracks.findIndex(t => t.type === 'music')
  const customTrack: Track = {
    id: 'track-custom-audio',
    type: 'audio',
    name: 'Custom Audio',
    clips: [],
    locked: false,
    visible: true,
    muted: false,
    solo: false,
    volume: 1,
    color: '#06B6D4',
    height: DEFAULT_TRACK_HEIGHTS.audio,
  }

  if (musicIndex >= 0) {
    tracks.splice(musicIndex, 0, customTrack)
  } else {
    tracks.push(customTrack)
  }
  return tracks
}

// ============================================================
// TIMELINE STORE
// ============================================================
interface TimelineState {
  timeline: Timeline
  selectedClipIds: string[]
  hoveredClipId: string | null
  activeTool: 'select' | 'blade' | 'hand'

  // Actions
  setZoom: (zoom: number) => void
  setScrollX: (x: number) => void
  setSnapEnabled: (v: boolean) => void
  setActiveTool: (tool: 'select' | 'blade' | 'hand') => void
  selectClip: (id: string, multi?: boolean) => void
  deselectAll: () => void

  addTrack: (type: TrackType) => void
  removeTrack: (id: string) => void
  updateTrack: (id: string, updates: Partial<Track>) => void

  addClipToTrack: (trackId: string, clip: Clip) => void
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<Clip>) => void
  moveClip: (clipId: string, newTrackId: string, newStartTime: number) => void
  splitClipAtTime: (clipId: string, time: number) => void
  trimClipStart: (clipId: string, delta: number) => void
  trimClipEnd: (clipId: string, delta: number) => void

  addMarker: (time: number, label?: string) => void
  removeMarker: (id: string) => void
  setInPoint: (time: number | undefined) => void
  setOutPoint: (time: number | undefined) => void
  recalcDuration: () => void
}

export const useTimelineStore = create<TimelineState>()(
  immer((set, get) => ({
    timeline: createDefaultTimeline(),
    selectedClipIds: [],
    hoveredClipId: null,
    activeTool: 'select',

    setZoom: (zoom) => set(s => { s.timeline.zoom = Math.min(400, Math.max(10, zoom)) }),
    setScrollX: (x) => set(s => { s.timeline.scrollX = Math.max(0, x) }),
    setSnapEnabled: (v) => set(s => { s.timeline.snapEnabled = v }),
    setActiveTool: (tool) => set(s => { s.activeTool = tool }),

    selectClip: (id, multi = false) => set(s => {
      if (multi) {
        const idx = s.selectedClipIds.indexOf(id)
        if (idx >= 0) s.selectedClipIds.splice(idx, 1)
        else s.selectedClipIds.push(id)
      } else {
        s.selectedClipIds = [id]
      }
    }),
    deselectAll: () => set(s => { s.selectedClipIds = [] }),

    addTrack: (type) => set(s => {
      const count = s.timeline.tracks.filter(t => t.type === type).length
      s.timeline.tracks.push({
        id: uid(), type, name: `${type.toUpperCase()}${count + 1}`,
        clips: [], locked: false, visible: true, muted: false, solo: false,
        volume: 1, color: TRACK_COLORS[type], height: DEFAULT_TRACK_HEIGHTS[type],
      })
    }),

    removeTrack: (id) => set(s => {
      s.timeline.tracks = s.timeline.tracks.filter(t => t.id !== id)
    }),

    updateTrack: (id, updates) => set(s => {
      const t = s.timeline.tracks.find(t => t.id === id)
      if (t) Object.assign(t, updates)
    }),

    addClipToTrack: (trackId, clip) => set(s => {
      const track = s.timeline.tracks.find(t => t.id === trackId)
      if (track) {
        track.clips.push(clip as any)
        get().recalcDuration()
      }
    }),

    removeClip: (clipId) => set(s => {
      for (const track of s.timeline.tracks) {
        const idx = track.clips.findIndex(c => c.id === clipId)
        if (idx >= 0) { track.clips.splice(idx, 1); break }
      }
      s.selectedClipIds = s.selectedClipIds.filter(id => id !== clipId)
      get().recalcDuration()
    }),

    updateClip: (clipId, updates) => set(s => {
      for (const track of s.timeline.tracks) {
        const clip = track.clips.find(c => c.id === clipId)
        if (clip) { Object.assign(clip, updates); break }
      }
      get().recalcDuration()
    }),

    moveClip: (clipId, newTrackId, newStartTime) => set(s => {
      let clip: Clip | undefined
      for (const track of s.timeline.tracks) {
        const idx = track.clips.findIndex(c => c.id === clipId)
        if (idx >= 0) { [clip] = track.clips.splice(idx, 1); break }
      }
      if (!clip) return
      clip.startTime = Math.max(0, newStartTime)
      clip.trackId = newTrackId
      const newTrack = s.timeline.tracks.find(t => t.id === newTrackId)
      if (newTrack) newTrack.clips.push(clip as any)
      get().recalcDuration()
    }),

    splitClipAtTime: (clipId, time) => set(s => {
      for (const track of s.timeline.tracks) {
        const idx = track.clips.findIndex(c => c.id === clipId)
        if (idx < 0) continue
        const clip = track.clips[idx] as VideoClip
        const splitOffset = time - clip.startTime
        if (splitOffset <= 0 || splitOffset >= clip.duration) break

        const leftClip: VideoClip = {
          ...clip,
          id: uid(),
          duration: splitOffset,
          fileEnd: clip.fileStart + splitOffset,
        }
        const rightClip: VideoClip = {
          ...clip,
          id: uid(),
          startTime: time,
          duration: clip.duration - splitOffset,
          fileStart: clip.fileStart + splitOffset,
        }
        track.clips.splice(idx, 1, leftClip as any, rightClip as any)
        break
      }
    }),

    trimClipStart: (clipId, delta) => set(s => {
      for (const track of s.timeline.tracks) {
        const clip = track.clips.find(c => c.id === clipId) as VideoClip
        if (!clip) continue
        const newStart = clip.startTime + delta
        const newDuration = clip.duration - delta
        if (newDuration > 0.1) {
          clip.startTime = Math.max(0, newStart)
          clip.duration = newDuration
          if ('fileStart' in clip) clip.fileStart += delta
        }
        break
      }
      get().recalcDuration()
    }),

    trimClipEnd: (clipId, delta) => set(s => {
      for (const track of s.timeline.tracks) {
        const clip = track.clips.find(c => c.id === clipId) as VideoClip
        if (!clip) continue
        const newDuration = clip.duration + delta
        if (newDuration > 0.1) {
          clip.duration = newDuration
          if ('fileEnd' in clip) clip.fileEnd += delta
        }
        break
      }
      get().recalcDuration()
    }),

    addMarker: (time, label = 'Marker') => set(s => {
      s.timeline.markers.push({ id: uid(), time, label, color: '#F59E0B' })
    }),
    removeMarker: (id) => set(s => {
      s.timeline.markers = s.timeline.markers.filter(m => m.id !== id)
    }),
    setInPoint: (time) => set(s => { s.timeline.inPoint = time }),
    setOutPoint: (time) => set(s => { s.timeline.outPoint = time }),

    recalcDuration: () => set(s => {
      let max = 0
      for (const track of s.timeline.tracks) {
        // Timeline content length is defined by video, audio narration, and overlays
        if (track.type === 'music') continue
        for (const clip of track.clips) {
          max = Math.max(max, clip.startTime + clip.duration)
        }
      }
      // Ensure at least 10 seconds or content max
      const finalDur = Math.max(max, 10)
      s.timeline.duration = finalDur

      // Automatically adjust ambient music bed to match full timeline
      const mTrack = s.timeline.tracks.find(t => t.type === 'music')
      const ambientClip = mTrack?.clips.find(c => c.id === 'clip-m-ambient')
      if (ambientClip) {
        ambientClip.duration = finalDur
        ambientClip.fileEnd = finalDur
      }

      // Immediately sync with PlayerStore so seek bar, cursor, and live preview can reach the entire length
      usePlayerStore.getState().setDuration(finalDur)
    }),
  }))
)

