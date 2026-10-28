import { create } from 'zustand'

interface PlayerState {
  currentTime: number
  duration: number
  isPlaying: boolean
  volume: number
  playbackRate: number
  isMuted: boolean
  loop: boolean
  loopStart?: number
  loopEnd?: number
  videoRef: HTMLVideoElement | null

  setVideoRef: (el: HTMLVideoElement | null) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  stepFrames: (frames: number, fps?: number) => void
  setVolume: (v: number) => void
  setMuted: (v: boolean) => void
  setPlaybackRate: (r: number) => void
  setCurrentTime: (t: number) => void
  setDuration: (d: number) => void
  setLoop: (start: number, end: number) => void
  clearLoop: () => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  volume: 1,
  playbackRate: 1,
  isMuted: false,
  loop: false,
  videoRef: null,

  setVideoRef: (el) => set({ videoRef: el }),

  play: () => {
    const v = get().videoRef
    if (v && v.src) {
      v.play().catch(() => {})
    }
    set({ isPlaying: true })
  },
  pause: () => {
    const v = get().videoRef
    if (v && v.src) {
      v.pause()
    }
    set({ isPlaying: false })
  },
  togglePlay: () => {
    const { isPlaying } = get()
    isPlaying ? get().pause() : get().play()
  },
  seek: (time) => {
    const dur = get().duration
    const maxDur = dur > 0 ? Math.max(dur, 60, time) : Infinity
    const clamped = Math.max(0, Math.min(time, maxDur))
    const v = get().videoRef
    if (v && v.src) {
      try { v.currentTime = clamped } catch (_) {}
    }
    set({ currentTime: clamped })
  },
  stepFrames: (frames, fps = 30) => {
    get().seek(get().currentTime + frames / fps)
  },
  setVolume: (v) => {
    const ref = get().videoRef
    if (ref) ref.volume = Math.min(1, v)
    set({ volume: v })
  },
  setMuted: (v) => {
    const ref = get().videoRef
    if (ref) ref.muted = v
    set({ isMuted: v })
  },
  setPlaybackRate: (r) => {
    const ref = get().videoRef
    if (ref) ref.playbackRate = r
    set({ playbackRate: r })
  },
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setLoop: (start, end) => set({ loop: true, loopStart: start, loopEnd: end }),
  clearLoop: () => set({ loop: false, loopStart: undefined, loopEnd: undefined }),
}))
