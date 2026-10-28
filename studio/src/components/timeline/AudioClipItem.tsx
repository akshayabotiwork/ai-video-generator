// AudioClipItem — same as VideoClipItem but shows waveform placeholder
// Full WaveSurfer.js integration can be added post-mount
import React from 'react'
import type { Clip } from '@/types/clip'
import { VideoClipItem } from './VideoClipItem'
import styles from './AudioClipItem.module.css'

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
}

export function AudioClipItem(props: Props) {
  const width = Math.max(props.clip.duration * props.zoom, 4)

  return (
    <VideoClipItem {...props}>
      {/* Waveform bars overlay */}
      <div className={styles.waveform} aria-hidden>
        {Array.from({ length: Math.floor(width / 3) }, (_, i) => (
          <div
            key={i}
            className={styles.bar}
            style={{ height: `${20 + Math.sin(i * 0.7) * 15 + Math.random() * 20}%` }}
          />
        ))}
      </div>
    </VideoClipItem>
  )
}

