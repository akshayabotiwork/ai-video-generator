import type { Clip } from './clip'

export type TrackType = 'video' | 'audio' | 'music' | 'overlay'

export interface Track {
  id: string
  type: TrackType
  name: string
  clips: Clip[]
  locked: boolean
  visible: boolean    // video tracks
  muted: boolean      // audio tracks
  solo: boolean       // audio tracks
  volume: number      // audio master volume 0–2
  color: string       // hex label color
  height: number      // px height in timeline
}

export interface Timeline {
  tracks: Track[]
  duration: number    // total project duration (seconds)
  zoom: number        // pixels per second
  scrollX: number     // horizontal scroll offset (px)
  snapEnabled: boolean
  markers: TimelineMarker[]
  inPoint?: number    // seconds
  outPoint?: number   // seconds
}

export interface TimelineMarker {
  id: string
  time: number
  label: string
  color: string
}

export const DEFAULT_TRACK_HEIGHTS: Record<TrackType, number> = {
  video: 72,
  audio: 56,
  music: 56,
  overlay: 40,
}

export const TRACK_COLORS: Record<TrackType, string> = {
  video: '#5B6EF5',
  audio: '#22C55E',
  music: '#EC4899',
  overlay: '#F59E0B',
}
