import type { Timeline } from './track'

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  timeline: Timeline
  settings: ProjectSettings
}

export interface ProjectSettings {
  resolution: Resolution
  fps: number
  aspectRatio: AspectRatio
  backgroundColor: string
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3'

export interface Resolution {
  width: number
  height: number
  label: string
}

export const RESOLUTIONS: Resolution[] = [
  { width: 1920, height: 1080, label: '1080p HD' },
  { width: 3840, height: 2160, label: '4K UHD' },
  { width: 1280, height: 720,  label: '720p' },
  { width: 854,  height: 480,  label: '480p' },
  { width: 1080, height: 1920, label: '1080p Vertical' },
  { width: 1080, height: 1080, label: '1080p Square' },
]

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  resolution: RESOLUTIONS[0],
  fps: 30,
  aspectRatio: '16:9',
  backgroundColor: '#000000',
}

// ============================================================
// MEDIA ASSET
// ============================================================

export type AssetType = 'video' | 'audio' | 'image'

export interface MediaAsset {
  id: string
  name: string
  type: AssetType
  src: string         // blob URL or remote URL
  thumbnail?: string
  duration?: number   // for video/audio
  width?: number
  height?: number
  size?: number       // bytes
  addedAt: string
}

// ============================================================
// HISTORY
// ============================================================

export interface HistoryEntry {
  id: string
  label: string       // "Added clip", "Trimmed clip", etc.
  timestamp: number
  snapshot: Timeline  // full timeline state snapshot
}
