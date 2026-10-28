import React from 'react'
import { useAIProjectStore } from '@/store/useAIProjectStore'
import { useTimelineStore } from '@/store/useTimelineStore'
import { useUIStore } from '@/store/useUIStore'
import styles from './ProjectSettingsPanel.module.css'

export function ProjectSettingsPanel() {
  const {
    exportSettings,
    setExportSettings,
  } = useAIProjectStore()
  const { timeline } = useTimelineStore()
  const { setShowExportModal } = useUIStore()

  const mTrack = timeline.tracks.find(t => t.type === 'music')
  const mClip = (mTrack?.clips as any[])?.find(c => !c.muted && c.src) || mTrack?.clips?.[0]
  const musicVolumePercent = mClip ? Math.round(((mClip.volume ?? 1.0) * (mTrack?.volume ?? 1.0)) * 100) : 100

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.title}>
            <span>⚙️</span> Export & Broadcast
          </div>
          <span className={styles.badge}>BROADCAST</span>
        </div>
        <p className={styles.subtitle}>
          Configure master audio mixing, news ticker, dynamic overlays, and scene transitions.
        </p>
      </div>

      {/* Broadcast Elements Section */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>
          <span>📺</span> Broadcast Overlays & Audio
        </div>
        <div className={styles.card}>
          {/* Subtitles Switch */}
          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <div className={styles.toggleTitle}>
                <span>💬</span> Dynamic Subtitles
              </div>
              <span className={styles.toggleDesc}>
                Render synchronized bottom subtitles for narration speech
              </span>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={exportSettings.includeSubtitles}
                onChange={(e) => setExportSettings({ includeSubtitles: e.target.checked })}
              />
              <span className={styles.slider} />
            </label>
          </div>

          {/* News Ticker Switch */}
          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <div className={styles.toggleTitle}>
                <span>📰</span> Bottom News Ticker
              </div>
              <span className={styles.toggleDesc}>
                Animated breaking news ticker bar scrolling along screen bottom
              </span>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={exportSettings.includeTicker}
                onChange={(e) => setExportSettings({ includeTicker: e.target.checked })}
              />
              <span className={styles.slider} />
            </label>
          </div>

          {/* Timeline Music Layer Switch */}
          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <div className={styles.toggleTitle}>
                <span>🎵</span> Timeline Music Layer
                <span className={styles.volumeBadge}>{musicVolumePercent}% Vol</span>
              </div>
              <span className={styles.toggleDesc}>
                Mix only audio clips explicitly added to the timeline music layer (zero synthetic ambient sound)
              </span>
            </div>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={exportSettings.includeMusic}
                onChange={(e) => setExportSettings({ includeMusic: e.target.checked })}
              />
              <span className={styles.slider} />
            </label>
          </div>
        </div>
      </div>

      {/* Transitions */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>
          <span>🎬</span> Transitions
        </div>
        <div className={styles.card}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Default Transition</label>
            <select
              className={styles.select}
              value={exportSettings.transition}
              onChange={(e) => setExportSettings({ transition: e.target.value })}
            >
              <option value="fade">Crossfade (Broadcast Standard)</option>
              <option value="wipeleft">Wipe Left</option>
              <option value="wiperight">Wipe Right</option>
              <option value="slideleft">Slide Left</option>
              <option value="circlecrop">Circle Iris Open</option>
              <option value="dissolve">Dissolve Grain</option>
              <option value="zoomin">Zoom In</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Transition Duration</label>
            <select
              className={styles.select}
              value={exportSettings.transitionDuration}
              onChange={(e) => setExportSettings({ transitionDuration: parseFloat(e.target.value) })}
            >
              <option value={0.3}>0.3s (Snappy)</option>
              <option value={0.5}>0.5s (Standard)</option>
              <option value={0.8}>0.8s (Cinematic)</option>
              <option value={1.0}>1.0s (Slow Fade)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Status Box */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryTitle}>
          <span>✨</span> Export Pipeline Preset
        </div>
        <div className={styles.summaryBadges}>
          <span className={`${styles.summaryPill} ${exportSettings.includeSubtitles ? styles.summaryPillActive : ''}`}>
            Subtitles: {exportSettings.includeSubtitles ? 'ON' : 'OFF'}
          </span>
          <span className={`${styles.summaryPill} ${exportSettings.includeTicker ? styles.summaryPillActive : ''}`}>
            Ticker: {exportSettings.includeTicker ? 'ON' : 'OFF'}
          </span>
          <span className={`${styles.summaryPill} ${exportSettings.includeMusic ? styles.summaryPillActive : ''}`}>
            Music Layer: {exportSettings.includeMusic ? `${musicVolumePercent}% (ON)` : 'OFF'}
          </span>
          <span className={styles.summaryPillActive}>
            Transition: {exportSettings.transition} ({exportSettings.transitionDuration}s)
          </span>
        </div>
      </div>

      {/* Export Button Trigger */}
      <button
        type="button"
        style={{
          padding: '10px 14px',
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          border: 'none',
          borderRadius: '7px',
          color: '#fff',
          fontWeight: 700,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginTop: 'auto',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
        }}
        onClick={() => setShowExportModal(true)}
      >
        <span>🚀</span> Open Export Dialog
      </button>
    </div>
  )
}
