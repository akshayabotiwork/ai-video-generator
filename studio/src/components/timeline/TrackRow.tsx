import React, { useCallback, useRef } from 'react'
import { useTimelineStore } from '@/store/useTimelineStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import { usePlayerStore } from '@/store/usePlayerStore'
import type { Track } from '@/types/track'
import type { Clip } from '@/types/clip'
import { VideoClipItem } from './VideoClipItem'
import { AudioClipItem } from './AudioClipItem'
import styles from './TrackRow.module.css'

interface Props {
  track: Track
  zoom: number
  scrollX: number
  headerWidth: number
  activeTool: 'select' | 'blade' | 'hand'
}

export function TrackRow({ track, zoom, scrollX, headerWidth, activeTool }: Props) {
  const {
    updateTrack, removeTrack, selectClip, splitClipAtTime,
    moveClip, selectedClipIds,
  } = useTimelineStore()
  const { pushHistory } = useHistoryStore()
  const trackBodyRef = useRef<HTMLDivElement>(null)

  const trackColor = track.color

  // Click on empty track area
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (activeTool === 'blade') return
    if (e.target !== e.currentTarget) return
    // Deselect
    useTimelineStore.getState().deselectAll()
  }, [activeTool])

  // Blade click on a clip → split it
  const handleClipBladeClick = useCallback((clipId: string) => {
    pushHistory('Split clip')
    splitClipAtTime(clipId, usePlayerStore.getState().currentTime)
  }, [splitClipAtTime, pushHistory])

  // Drag clip to new position
  const handleClipDragEnd = useCallback((clipId: string, deltaX: number) => {
    const deltaTime = deltaX / zoom
    const clip = track.clips.find(c => c.id === clipId)
    if (!clip) return
    pushHistory('Move clip')
    moveClip(clipId, track.id, clip.startTime + deltaTime)
  }, [zoom, track, moveClip, pushHistory])

  const isAudioTrack = track.type === 'audio' || track.type === 'music'

  return (
    <div className={styles.trackRow} style={{ height: track.height }}>
      {/* Track Header */}
      <div className={styles.header} style={{ width: headerWidth, borderLeftColor: trackColor }}>
        <div className={styles.headerLeft}>
          <div className={styles.trackIcon} style={{ color: trackColor }}>
            {track.type === 'video' && '🎥'}
            {track.type === 'audio' && (track.name.toLowerCase().includes('custom') ? '🎧' : '🎙️')}
            {track.type === 'music' && '🎵'}
            {track.type === 'overlay' && '🅰️'}
          </div>
          <span className={styles.trackName}>{track.name}</span>
        </div>
        <div className={styles.headerControls}>
          {/* Visibility (video) */}
          {!isAudioTrack && (
            <button
              className={`${styles.controlBtn} ${!track.visible ? styles.dim : ''}`}
              onClick={() => updateTrack(track.id, { visible: !track.visible })}
              title="Toggle Visibility"
            >👁</button>
          )}
          {/* Mute (audio) */}
          {isAudioTrack && (
            <button
              className={`${styles.controlBtn} ${track.muted ? styles.dim : ''}`}
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              title="Toggle Mute"
            >🔇</button>
          )}
          {/* Lock */}
          <button
            className={`${styles.controlBtn} ${track.locked ? styles.locked : ''}`}
            onClick={() => updateTrack(track.id, { locked: !track.locked })}
            title="Toggle Lock"
          >{track.locked ? '🔒' : '🔓'}</button>
        </div>
      </div>

      {/* Track Body (clips) */}
      <div
        ref={trackBodyRef}
        className={`${styles.body} ${activeTool === 'blade' ? styles.bladeCursor : ''}`}
        onClick={handleTrackClick}
        style={{ opacity: track.visible ? 1 : 0.4 }}
      >
        {/* Inner scrollable content */}
        <div className={styles.bodyInner} style={{ transform: `translateX(${-scrollX}px)` }}>
          {track.clips.map(clip => (
            isAudioTrack ? (
              <AudioClipItem
                key={clip.id}
                clip={clip}
                zoom={zoom}
                isSelected={selectedClipIds.includes(clip.id)}
                trackColor={trackColor}
                onSelect={(id, multi) => selectClip(id, multi)}
                onBladeClick={handleClipBladeClick}
                onDragEnd={handleClipDragEnd}
                activeTool={activeTool}
                locked={track.locked}
              />
            ) : (
              <VideoClipItem
                key={clip.id}
                clip={clip}
                zoom={zoom}
                isSelected={selectedClipIds.includes(clip.id)}
                trackColor={trackColor}
                onSelect={(id, multi) => selectClip(id, multi)}
                onBladeClick={handleClipBladeClick}
                onDragEnd={handleClipDragEnd}
                activeTool={activeTool}
                locked={track.locked}
              />
            )
          ))}
        </div>

        {/* Drop zone indicator */}
        {!track.locked && (
          <div className={styles.dropHint}>
            Drop media here
          </div>
        )}
      </div>
    </div>
  )
}
