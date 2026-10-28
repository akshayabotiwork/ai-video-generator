import React, { useRef, useCallback } from 'react'
import { usePlayerStore } from '@/store/usePlayerStore'
import styles from './TimelineRuler.module.css'

interface Props {
  zoom: number
  duration: number
  scrollX: number
  onSeek: (t: number) => void
}

function formatRulerTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export function TimelineRuler({ zoom, duration, scrollX, onSeek }: Props) {
  const rulerRef = useRef<HTMLDivElement>(null)
  const { currentTime } = usePlayerStore()

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = rulerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left + scrollX
    onSeek(x / zoom)

    const onMove = (ev: MouseEvent) => {
      const x2 = ev.clientX - rect.left + scrollX
      onSeek(Math.max(0, x2 / zoom))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoom, scrollX, onSeek])

  // Generate tick marks
  const totalWidth = duration * zoom
  const tickInterval = zoom >= 100 ? 1 : zoom >= 40 ? 5 : zoom >= 15 ? 10 : 30
  const ticks: number[] = []
  for (let t = 0; t <= duration; t += tickInterval) ticks.push(t)

  const playheadX = currentTime * zoom - scrollX

  return (
    <div className={styles.ruler} ref={rulerRef} onMouseDown={handleMouseDown}>
      <div className={styles.rulerInner} style={{ width: totalWidth }}>
        {ticks.map(t => (
          <div
            key={t}
            className={styles.tick}
            style={{ left: t * zoom - scrollX }}
          >
            <div className={styles.tickLine} />
            <span className={styles.tickLabel}>{formatRulerTime(t)}</span>
          </div>
        ))}
      </div>

      {/* Playhead on ruler */}
      {playheadX >= 0 && (
        <div className={styles.playhead} style={{ left: playheadX }}>
          <div className={styles.playheadHead} />
        </div>
      )}
    </div>
  )
}
