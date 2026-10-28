import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Timeline } from '@/types/track'
import type { HistoryEntry } from '@/types/project'
import { useTimelineStore } from './useTimelineStore'

const MAX_HISTORY = 100

interface HistoryState {
  past: HistoryEntry[]
  future: HistoryEntry[]

  pushHistory: (label: string) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  clearHistory: () => void
}

export const useHistoryStore = create<HistoryState>()(
  immer((set, get) => ({
    past: [],
    future: [],

    pushHistory: (label) => {
      const snapshot: Timeline = JSON.parse(
        JSON.stringify(useTimelineStore.getState().timeline)
      )
      set(s => {
        s.past.push({ id: crypto.randomUUID(), label, timestamp: Date.now(), snapshot })
        if (s.past.length > MAX_HISTORY) s.past.shift()
        s.future = []  // clear redo on new action
      })
    },

    undo: () => {
      const { past } = get()
      if (!past.length) return
      const entry = past[past.length - 1]
      // Save current state to redo
      const currentSnapshot: Timeline = JSON.parse(
        JSON.stringify(useTimelineStore.getState().timeline)
      )
      set(s => {
        s.future.unshift({ id: crypto.randomUUID(), label: entry.label, timestamp: Date.now(), snapshot: currentSnapshot })
        s.past.pop()
      })
      // Restore
      useTimelineStore.setState(s => { s.timeline = entry.snapshot })
    },

    redo: () => {
      const { future } = get()
      if (!future.length) return
      const entry = future[0]
      const currentSnapshot: Timeline = JSON.parse(
        JSON.stringify(useTimelineStore.getState().timeline)
      )
      set(s => {
        s.past.push({ id: crypto.randomUUID(), label: entry.label, timestamp: Date.now(), snapshot: currentSnapshot })
        s.future.shift()
      })
      useTimelineStore.setState(s => { s.timeline = entry.snapshot })
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
    clearHistory: () => set(s => { s.past = []; s.future = [] }),
  }))
)
