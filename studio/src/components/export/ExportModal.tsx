import React from 'react'
import { useUIStore } from '@/store/useUIStore'
import { useAIProjectStore } from '@/store/useAIProjectStore'
import { useTimelineStore } from '@/store/useTimelineStore'
import styles from './ExportModal.module.css'

export function ExportModal() {
  const { setShowExportModal } = useUIStore()
  const { timeline } = useTimelineStore()
  const {
    project,
    isRendering,
    renderProgress,
    renderStage,
    renderedVideoUrl,
    renderProject,
    cancelRender,
    resetRender,
    exportSettings,
    setExportSettings,
    setActiveTab,
  } = useAIProjectStore()

  const handleClose = () => {
    if (!isRendering) {
      if (renderedVideoUrl) resetRender()
      setShowExportModal(false)
    }
  }

  const handleStartExport = () => {
    renderProject()
  }

  const totalTimelineClips = timeline.tracks.flatMap(t => t.clips).length
  const hasContent = (project && project.scenes.length > 0) || totalTimelineClips > 0
  const mTrack = timeline.tracks.find(t => t.type === 'music')
  const mClip = (mTrack?.clips as any[])?.find(c => !c.muted && c.src) || mTrack?.clips?.[0]
  const musicVolumePercent = mClip ? Math.round(((mClip.volume ?? 1.0) * (mTrack?.volume ?? 1.0)) * 100) : 100

  return (
    <div
      className={styles.backdrop}
      onClick={handleClose}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>🚀 Export 1080p Broadcast Video</h2>
          {!isRendering && (
            <button
              className={styles.closeBtn}
              onClick={handleClose}
            >
              ✕
            </button>
          )}
        </div>

        {!isRendering && !renderedVideoUrl ? (
          <div className={styles.body}>
            {/* Project info */}
            <div style={{ fontSize: '12px', color: 'var(--text-3)', paddingBottom: '4px' }}>
              Project: <strong style={{ color: 'var(--text-1)' }}>{project?.title || 'Current Project'}</strong>
              {project && (
                <span> ({project.scenes.length} scenes, {(project.total_timeline_duration || 0).toFixed(1)}s)</span>
              )}
            </div>

            {/* Configured Settings Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)' }}>Broadcast Config</span>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: '11px',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                  onClick={() => {
                    handleClose()
                    setActiveTab('settings')
                  }}
                >
                  Edit in Settings ⚙️
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: exportSettings.includeSubtitles ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: exportSettings.includeSubtitles ? '#93c5fd' : 'var(--text-3)',
                  border: `1px solid ${exportSettings.includeSubtitles ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`
                }}>
                  💬 Subtitles: {exportSettings.includeSubtitles ? 'ON' : 'OFF'}
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: exportSettings.includeTicker ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: exportSettings.includeTicker ? '#93c5fd' : 'var(--text-3)',
                  border: `1px solid ${exportSettings.includeTicker ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`
                }}>
                  📰 Ticker: {exportSettings.includeTicker ? 'ON' : 'OFF'}
                </span>
                <span style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: exportSettings.includeMusic ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: exportSettings.includeMusic ? '#6ee7b7' : 'var(--text-3)',
                  border: `1px solid ${exportSettings.includeMusic ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`
                }}>
                  🎵 Music Layer: {exportSettings.includeMusic ? `${musicVolumePercent}% Vol` : 'OFF'}
                </span>
              </div>
            </div>

            {/* Default Transition */}
            <div className={styles.row}>
              <label>Transition</label>
              <select
                value={exportSettings.transition}
                onChange={(e) => setExportSettings({ transition: e.target.value })}
                className={styles.select}
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

            {/* Transition duration */}
            <div className={styles.row}>
              <label>Trans. Duration</label>
              <select
                value={exportSettings.transitionDuration}
                onChange={(e) => setExportSettings({ transitionDuration: parseFloat(e.target.value) })}
                className={styles.select}
              >
                <option value={0.3}>0.3s (Snappy)</option>
                <option value={0.5}>0.5s (Standard)</option>
                <option value={0.8}>0.8s (Cinematic)</option>
                <option value={1.0}>1.0s (Slow Fade)</option>
              </select>
            </div>

            <button
              className={styles.exportBtn}
              onClick={handleStartExport}
              disabled={!hasContent}
            >
              {hasContent ? '🚀 Start Single-Pass 1080p Render' : '⚠️ Please add clips to timeline or generate AI script'}
            </button>
          </div>
        ) : isRendering ? (
          <div className={styles.progressBody}>
            <div className={styles.progressLabel}>
              {renderStage || 'Rendering Broadcast Video...'}
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <div className={styles.progressPct}>{Math.round(renderProgress)}%</div>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              Executing single-pass FFmpeg compositing with Ken Burns & transitions
            </span>
            <button
              type="button"
              onClick={() => {
                cancelRender()
                handleClose()
              }}
              style={{
                marginTop: '12px',
                padding: '6px 14px',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              ✕ Cancel Render
            </button>
          </div>
        ) : (
          <div className={styles.progressBody}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>
              🎉 Export Finished!
            </div>
            <div className={styles.progressLabel}>
              1080p Broadcast Video is ready
            </div>
            {renderedVideoUrl && (
              <video
                key={renderedVideoUrl}
                src={renderedVideoUrl}
                controls
                autoPlay
                style={{
                  width: '100%',
                  maxHeight: '200px',
                  borderRadius: '8px',
                  background: '#000',
                  margin: '8px 0',
                }}
              />
            )}
            <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '6px' }}>
              <a
                href={renderedVideoUrl || '#'}
                download="broadcast_video_1080p.mp4"
                className={styles.exportBtn}
                style={{ textAlign: 'center', textDecoration: 'none', flex: 1 }}
              >
                ⬇ Download Video
              </a>
              <button
                type="button"
                className={styles.exportBtn}
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-1)',
                  border: '1px solid var(--border)',
                  flex: 1,
                }}
                onClick={() => resetRender()}
              >
                🔄 Re-Export New Changes
              </button>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              style={{ width: 'auto', padding: '4px 12px', marginTop: '4px' }}
              onClick={handleClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
