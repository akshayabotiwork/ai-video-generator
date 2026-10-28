// ============================================================
// CLIP TYPES
// ============================================================

export type ClipType = 'video' | 'audio' | 'overlay' | 'music'

export interface BaseClip {
  id: string
  trackId: string
  startTime: number   // seconds on timeline
  duration: number    // seconds
  name: string
}

export interface VideoClip extends BaseClip {
  type: 'video'
  src: string         // blob URL or server URL
  fileStart: number   // trim start in source file (seconds)
  fileEnd: number     // trim end in source file (seconds)
  originalDuration: number
  thumbnail?: string
  // Effects
  filters: ColorFilters
  motion?: string
  effect?: string
  speed: number       // 0.25x – 4x
  opacity: number     // 0–1
  transition?: TransitionEffect
}

export interface AudioClip extends BaseClip {
  type: 'audio' | 'music'
  src: string
  fileStart: number
  fileEnd: number
  originalDuration: number
  volume: number      // 0–2
  fadeIn: number      // seconds
  fadeOut: number     // seconds
  pan: number         // -1 (left) to 1 (right)
  muted: boolean
}

export interface OverlayClip extends BaseClip {
  type: 'overlay'
  overlayType: 'text' | 'image' | 'shape'
  // Overlay data stored as Fabric.js JSON snapshot
  fabricJson: string
  // Position/size on video canvas (0–1 normalized)
  x: number
  y: number
  width: number
  height: number
  animation?: OverlayAnimation
}

export type Clip = VideoClip | AudioClip | OverlayClip

// ============================================================
// COLOR & EFFECTS
// ============================================================

export interface ColorFilters {
  brightness: number    // -100 to 100
  contrast: number      // -100 to 100
  saturation: number    // -100 to 100
  hue: number           // 0 to 360
  temperature: number   // -100 (cool) to 100 (warm)
  exposure: number      // -100 to 100
  preset?: ColorPreset
}

export type ColorPreset =
  | 'none'
  | 'cinematic'
  | 'news'
  | 'warm'
  | 'film'
  | 'bw'
  | 'vintage'

export const DEFAULT_COLOR_FILTERS: ColorFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  exposure: 0,
  preset: 'cinematic',
}

export interface TransitionEffect {
  type: TransitionType
  duration: number      // seconds
  position: 'start' | 'end'
}

export type TransitionType =
  | 'cut'
  | 'fade'
  | 'dissolve'
  | 'fade_black'
  | 'fadeblack'
  | 'fade_white'
  | 'fadewhite'
  | 'wipe_left'
  | 'wipeleft'
  | 'wipe_right'
  | 'wiperight'
  | 'wipe_up'
  | 'wipeup'
  | 'wipe_down'
  | 'wipedown'
  | 'zoom_in'
  | 'zoomin'
  | 'zoom_out'
  | 'zoomout'
  | 'slide_left'
  | 'slideleft'
  | 'slide_right'
  | 'slideright'
  | 'circlecrop'
  | 'circle_iris'
  | 'blur'
  | 'flash'

export type OverlayAnimation =
  | 'none'
  | 'fade_in'
  | 'slide_up'
  | 'slide_left'
  | 'zoom_in'
  | 'typewriter'
