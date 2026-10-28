import React, { useRef, useCallback, useEffect } from 'react'
import { useTimelineStore, ensureCustomAudioTrack } from '@/store/useTimelineStore'
import { usePlayerStore } from '@/store/usePlayerStore'
import { TimelineRuler } from './TimelineRuler'
import { TrackRow } from './TrackRow'
import styles from './TimelinePanel.module.css'

const TRACK_HEADER_WIDTH = 160

export function TimelinePanel() {
  const { timeline, setZoom, setScrollX, activeTool, addTrack } = useTimelineStore()
  const { seek, currentTime } = usePlayerStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    useTimelineStore.setState((s) => {
      ensureCustomAudioTrack(s.timeline.tracks)
    })
  }, [])

  // Ctrl+Scroll → zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.85 : 1.15
      setZoom(timeline.zoom * delta)
    } else {
      setScrollX(timeline.scrollX + e.deltaX + e.deltaY)
    }
  }, [timeline.zoom, timeline.scrollX, setZoom, setScrollX])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <div className={styles.timeline}>
      {/* Timeline toolbar */}
      <div className={styles.toolbar}>
        <div style={{ width: TRACK_HEADER_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className={styles.addTrackBtn} onClick={() => addTrack('video')} title="Add Video Track">+ Video</button>
          <button className={styles.addTrackBtn} onClick={() => addTrack('audio')} title="Add Audio Track">+ Audio</button>
        </div>
        <div className={styles.zoomGroup}>
          <button className={styles.toolbarBtn} onClick={() => setZoom(timeline.zoom * 0.8)} title="Zoom Out (-)">−</button>
          <span className={styles.zoomLabel}>{Math.round(timeline.zoom)}px/s</span>
          <button className={styles.toolbarBtn} onClick={() => setZoom(timeline.zoom * 1.25)} title="Zoom In (+)">+</button>
          <button className={styles.toolbarBtn} onClick={() => setZoom(80)} title="Reset Zoom">Fit</button>
        </div>
        <div className={styles.snapToggle}>
          <label>
            <input
              type="checkbox"
              checked={timeline.snapEnabled}
              onChange={e => useTimelineStore.getState().setSnapEnabled(e.target.checked)}
            />
            Snap
          </label>
        </div>
      </div>

      {/* Scrollable track area */}
      <div className={styles.trackArea} ref={scrollRef}>
        {/* Ruler */}
        <div className={styles.rulerRow}>
          <div style={{ width: TRACK_HEADER_WIDTH, flexShrink: 0, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }} />
          <TimelineRuler
            zoom={timeline.zoom}
            duration={Math.max(timeline.duration + 10, 60)}
            scrollX={timeline.scrollX}
            onSeek={seek}
          />
        </div>

        {/* Tracks */}
        <div className={styles.tracks}>
          {timeline.tracks.map(track => (
            <TrackRow
              key={track.id}
              track={track}
              zoom={timeline.zoom}
              scrollX={timeline.scrollX}
              headerWidth={TRACK_HEADER_WIDTH}
              activeTool={activeTool}
            />
          ))}
        </div>

        {/* Full-height Playhead line across tracks */}
        {currentTime * timeline.zoom - timeline.scrollX >= 0 && (
          <div
            style={{
              position: 'absolute',
              top: 28,
              bottom: 0,
              left: TRACK_HEADER_WIDTH + (currentTime * timeline.zoom - timeline.scrollX),
              width: 1,
              background: 'var(--amber, #f59e0b)',
              pointerEvents: 'none',
              zIndex: 15,
            }}
          />
        )}
      </div>
    </div>
  )
}
