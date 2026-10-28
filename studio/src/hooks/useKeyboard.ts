import { useEffect, useCallback } from 'react'
import { usePlayerStore } from '@/store/usePlayerStore'
import { useTimelineStore } from '@/store/useTimelineStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import { useUIStore } from '@/store/useUIStore'

export function useKeyboard() {
  const { togglePlay, stepFrames, seek } = usePlayerStore()
  const { activeTool, setActiveTool, selectedClipIds, removeClip, addMarker, setInPoint, setOutPoint } = useTimelineStore()
  const { undo, redo, canUndo, canRedo } = useHistoryStore()
  const { setShowKeyboardHelp, setShowExportModal } = useUIStore()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't fire when typing in inputs/textareas
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    const ctrl = e.ctrlKey || e.metaKey

    switch (e.key) {
      // ── Playback ──
      case ' ':
        e.preventDefault()
        togglePlay()
        break
      case 'k':
      case 'K':
        e.preventDefault()
        usePlayerStore.getState().pause()
        break
      case 'j':
      case 'J':
        e.preventDefault()
        usePlayerStore.getState().setPlaybackRate(
          usePlayerStore.getState().playbackRate <= -2 ? -4 : -2
        )
        break
      case 'l':
      case 'L':
        e.preventDefault()
        usePlayerStore.getState().setPlaybackRate(
          usePlayerStore.getState().playbackRate >= 2 ? 4 : 2
        )
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (e.shiftKey) stepFrames(-10)
        else stepFrames(-1)
        break
      case 'ArrowRight':
        e.preventDefault()
        if (e.shiftKey) stepFrames(10)
        else stepFrames(1)
        break

      // ── Tools ──
      case 'v':
      case 'V':
        if (!ctrl) { e.preventDefault(); setActiveTool('select') }
        break
      case 'b':
      case 'B':
        if (!ctrl) { e.preventDefault(); setActiveTool('blade') }
        break
      case 'h':
      case 'H':
        if (!ctrl) { e.preventDefault(); setActiveTool('hand') }
        break

      // ── Edit ──
      case 'z':
      case 'Z':
        if (ctrl) {
          e.preventDefault()
          if (e.shiftKey) { if (canRedo()) redo() }
          else { if (canUndo()) undo() }
        }
        break
      case 'Delete':
      case 'Backspace':
        if (!ctrl) {
          e.preventDefault()
          selectedClipIds.forEach(id => removeClip(id))
        }
        break

      // ── Markers & Points ──
      case 'm':
      case 'M':
        e.preventDefault()
        addMarker(usePlayerStore.getState().currentTime)
        break
      case 'i':
      case 'I':
        e.preventDefault()
        setInPoint(usePlayerStore.getState().currentTime)
        break
      case 'o':
      case 'O':
        e.preventDefault()
        setOutPoint(usePlayerStore.getState().currentTime)
        break

      // ── Export ──
      case 'e':
      case 'E':
        if (ctrl) { e.preventDefault(); setShowExportModal(true) }
        break

      // ── Help ──
      case '?':
        e.preventDefault()
        setShowKeyboardHelp(true)
        break

      // ── Timeline Zoom ──
      case '=':
      case '+':
        if (!ctrl) {
          e.preventDefault()
          useTimelineStore.getState().setZoom(
            useTimelineStore.getState().timeline.zoom * 1.25
          )
        }
        break
      case '-':
      case '_':
        if (!ctrl) {
          e.preventDefault()
          useTimelineStore.getState().setZoom(
            useTimelineStore.getState().timeline.zoom * 0.8
          )
        }
        break
    }
  }, [togglePlay, stepFrames, setActiveTool, undo, redo, canUndo, canRedo,
      selectedClipIds, removeClip, addMarker, setInPoint, setOutPoint,
      setShowKeyboardHelp, setShowExportModal])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
