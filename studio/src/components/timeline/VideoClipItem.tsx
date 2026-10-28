import React, { useRef, useCallback, useState } from 'react'
import type { Clip } from '@/types/clip'
import { useTimelineStore } from '@/store/useTimelineStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import styles from './VideoClipItem.module.css'

interface Props {
  clip: Clip
  zoom: number
  isSelected: boolean
  trackColor: string
  onSelect: (id: string, multi: boolean) => void
  onBladeClick: (id: string) => void
  onDragEnd: (id: string, deltaX: number) => void
  activeTool: 'select' | 'blade' | 'hand'
  locked: boolean
  children?: React.ReactNode
}

export function VideoClipItem({ clip, zoom, isSelected, trackColor, onSelect, onBladeClick, onDragEnd, activeTool, locked, children }: Props) {
  const { trimClipStart, trimClipEnd } = useTimelineStore()
  const { pushHistory } = useHistoryStore()

  const left = clip.startTime * zoom
  const width = Math.max(clip.duration * zoom, 4)

  const dragStartX = useRef(0)
  const isDragging = useRef(false)
  const [dragDelta, setDragDelta] = useState(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (locked) return
    if (activeTool === 'blade') { onBladeClick(clip.id); return }
    onSelect(clip.id, e.shiftKey)
    if (activeTool !== 'select') return

    dragStartX.current = e.clientX
    isDragging.current = false

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartX.current
      if (Math.abs(delta) > 3) isDragging.current = true
      if (isDragging.current) setDragDelta(delta)
    }
    const onUp = (ev: MouseEvent) => {
      const delta = ev.clientX - dragStartX.current
      if (isDragging.current) onDragEnd(clip.id, delta)
      setDragDelta(0)
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [clip.id, locked, activeTool, onBladeClick, onSelect, onDragEnd])

  // Trim left edge
  const handleTrimLeft = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dt = dx / zoom
      trimClipStart(clip.id, dt)
    }
    const onUp = () => {
      pushHistory('Trim clip start')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [clip.id, zoom, trimClipStart, pushHistory])

  // Trim right edge
  const handleTrimRight = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dt = dx / zoom
      trimClipEnd(clip.id, dt)
    }
    const onUp = () => {
      pushHistory('Trim clip end')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [clip.id, zoom, trimClipEnd, pushHistory])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (locked) return
    if (activeTool === 'blade') {
      onBladeClick(clip.id)
      return
    }
    onSelect(clip.id, e.shiftKey)
  }, [clip.id, locked, activeTool, onBladeClick, onSelect])

  return (
    <div
      className={`${styles.clip} ${isSelected ? styles.selected : ''} ${activeTool === 'blade' ? styles.blade : ''}`}
      style={{
        left: left + dragDelta,
        width,
        '--clip-color': trackColor,
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      title={clip.name}
    >
      {/* Left trim handle */}
      <div className={styles.trimLeft} onMouseDown={handleTrimLeft} />

      {/* Clip content */}
      <div className={styles.clipContent}>
        <span className={styles.clipName}>{clip.name}</span>
        {(clip as any).transition?.type && width > 50 && (
          <span
            className={styles.transitionBadge}
            title={`Transition: ${(clip as any).transition.type} (${(clip as any).transition.duration || 0.5}s)`}
          >
            ⚡ {(clip as any).transition.type}
          </span>
        )}
        <span className={styles.clipDuration}>{clip.duration.toFixed(1)}s</span>
      </div>

      {children}

      {/* Right trim handle */}
      <div className={styles.trimRight} onMouseDown={handleTrimRight} />
    </div>
  )
}
