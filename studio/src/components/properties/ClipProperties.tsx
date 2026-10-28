import React from 'react'
import { useTimelineStore } from '@/store/useTimelineStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import { useAIProjectStore } from '@/store/useAIProjectStore'
import type { Clip } from '@/types/clip'
import styles from './PropertiesPanel.module.css'

interface Props { clip: Clip }

export function ClipProperties({ clip }: Props) {
  const { updateClip, removeClip, timeline } = useTimelineStore()
  const { pushHistory } = useHistoryStore()
  const openSwapModal = useAIProjectStore(s => s.openSwapModal)
  const syncTimelineWithAudio = useAIProjectStore(s => s.syncTimelineWithAudio)
  const isSyncingAudio = useAIProjectStore(s => s.isSyncingAudio)
  const cancelSyncAudio = useAIProjectStore(s => s.cancelSyncAudio)

  const handleSwapClick = () => {
    const match = clip.id.match(/^clip-v-(\d+)(?:-(\d+))?$/)
    const sceneId = match ? parseInt(match[1]) : 1
    const shotIndex = match && match[2] ? parseInt(match[2]) - 1 : 0
    openSwapModal(sceneId, shotIndex, clip.id)
  }

  const track = timeline.tracks.find(t => t.id === clip.trackId || t.clips.some(c => c.id === clip.id))
  const isMusicTrack = track?.type === 'music' || track?.name?.toLowerCase().includes('music')
  const isCustomAudio = clip.trackId === 'track-custom-audio' ||
    track?.id === 'track-custom-audio' ||
    track?.name?.toLowerCase().includes('custom') ||
    (clip.type === 'audio' && !isMusicTrack)

  return (
    <div className={styles.section}>
      <div className="section-header">Clip Info</div>

      <div className={styles.propRow}>
        <span className={styles.propLabel}>Name</span>
        <input
          type="text"
          className={styles.propInput}
          value={clip.name}
          onChange={e => updateClip(clip.id, { name: e.target.value })}
        />
      </div>

      <div className={styles.propRow}>
        <span className={styles.propLabel}>Start</span>
        <span className={styles.propVal}>{clip.startTime.toFixed(2)}s</span>
      </div>

      <div className={styles.propRow}>
        <span className={styles.propLabel}>Duration</span>
        <span className={styles.propVal}>{clip.duration.toFixed(2)}s</span>
      </div>

      {'speed' in clip && (
        <>
          <div className="section-header" style={{marginTop: 12}}>Video Visual</div>
          <div style={{ marginTop: 6, marginBottom: 12 }}>
            <button
              type="button"
              className={styles.swapClipBtn}
              onClick={handleSwapClick}
              title="Search and swap image for this shot"
            >
              🔄 Swap Visual / Photo
            </button>
          </div>
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Speed</span>
            <input
              type="range" min={0.25} max={4} step={0.25}
              value={(clip as any).speed ?? 1}
              onChange={e => updateClip(clip.id, { speed: parseFloat(e.target.value) } as any)}
              className={styles.slider}
            />
            <span className={styles.sliderVal}>{((clip as any).speed ?? 1)}×</span>
          </div>
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Opacity</span>
            <input
              type="range" min={0} max={1} step={0.01}
              value={(clip as any).opacity ?? 1}
              onChange={e => updateClip(clip.id, { opacity: parseFloat(e.target.value) } as any)}
              className={styles.slider}
            />
            <span className={styles.sliderVal}>{Math.round(((clip as any).opacity ?? 1) * 100)}%</span>
          </div>
        </>
      )}

      {'volume' in clip && (
        <>
          <div className="section-header" style={{marginTop: 12}}>Audio</div>
          {isCustomAudio && (
            <div style={{ marginTop: 6, marginBottom: 12 }}>
              {isSyncingAudio ? (
                <div className={styles.syncRunningBox}>
                  <div className={styles.syncRunningText}>
                    <span className={styles.spinIcon}>⏳</span>
                    <span>AI Syncing Speech...</span>
                  </div>
                  <button
                    type="button"
                    className={styles.cancelSyncBtn}
                    onClick={cancelSyncAudio}
                    title="Cancel speech alignment"
                  >
                    ✕ Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.syncAudioBtn}
                  onClick={() => syncTimelineWithAudio(clip.id)}
                  title="Sync V1 layer clips duration to match this custom audio duration"
                >
                  🔄 Sync Timeline with Audio
                </button>
              )}
            </div>
          )}
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Volume</span>
            <input
              type="range" min={0} max={2} step={0.01}
              value={(clip as any).volume ?? 1}
              onChange={e => updateClip(clip.id, { volume: parseFloat(e.target.value) } as any)}
              className={styles.slider}
            />
            <span className={styles.sliderVal}>{Math.round(((clip as any).volume ?? 1) * 100)}%</span>
          </div>
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Fade In</span>
            <input
              type="range" min={0} max={3} step={0.1}
              value={(clip as any).fadeIn ?? 0}
              onChange={e => updateClip(clip.id, { fadeIn: parseFloat(e.target.value) } as any)}
              className={styles.slider}
            />
            <span className={styles.sliderVal}>{((clip as any).fadeIn ?? 0).toFixed(1)}s</span>
          </div>
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Fade Out</span>
            <input
              type="range" min={0} max={3} step={0.1}
              value={(clip as any).fadeOut ?? 0}
              onChange={e => updateClip(clip.id, { fadeOut: parseFloat(e.target.value) } as any)}
              className={styles.slider}
            />
            <span className={styles.sliderVal}>{((clip as any).fadeOut ?? 0).toFixed(1)}s</span>
          </div>
        </>
      )}

      <div style={{marginTop: 16}}>
        <button
          className={styles.deleteBtn}
          onClick={() => { pushHistory('Delete clip'); removeClip(clip.id) }}
        >🗑 Remove Clip</button>
      </div>
    </div>
  )
}
