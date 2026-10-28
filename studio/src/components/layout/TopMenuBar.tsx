import React from 'react'
import { useUIStore } from '@/store/useUIStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import { useTimelineStore } from '@/store/useTimelineStore'
import { useAIProjectStore } from '@/store/useAIProjectStore'
import styles from './TopMenuBar.module.css'

export function TopMenuBar() {
  const { setShowExportModal, setShowProjectSettings, setShowKeyboardHelp } = useUIStore()
  const { canUndo, canRedo, undo, redo, past, future } = useHistoryStore()
  const { activeTool, setActiveTool } = useTimelineStore()
  const {
    aspectRatio,
    setAspectRatio,
    setActiveTab,
    logs,
    project,
    isRendering,
    renderProgress,
    renderStage,
    renderedVideoUrl,
    renderProject,
    cancelRender,
    resetRender,
  } = useAIProjectStore()

  return (
    <header className={styles.topbar}>
      {/* Brand */}
      <div className={styles.brand}>
        <span className={styles.brandIcon}>🎬</span>
        <span className={styles.brandName}>
          VideoEditor <span className={styles.pro}>PRO</span>
        </span>
      </div>

      <div className={styles.divider} />

      {/* AI Director Fast Action */}
      <button
        type="button"
        className={styles.aiDirectorBtn}
        onClick={() => setActiveTab('script')}
        title="Open AI Director to input or tweak script"
      >
        <span>✨</span>
        <span>AI Script Director</span>
      </button>

      <div className={styles.divider} />

      {/* Aspect Ratio Switcher */}
      <div className={styles.aspectToggle} title="Switch Player & Export Aspect Ratio">
        <button
          type="button"
          className={`${styles.aspectBtn} ${aspectRatio === '16:9' ? styles.active : ''}`}
          onClick={() => setAspectRatio('16:9')}
        >
          📺 16:9
        </button>
        <button
          type="button"
          className={`${styles.aspectBtn} ${aspectRatio === '9:16' ? styles.active : ''}`}
          onClick={() => setAspectRatio('9:16')}
        >
          📱 9:16
        </button>
      </div>

      <div className={styles.divider} />

      {/* Edit — Undo/Redo */}
      <div className={styles.menuGroup}>
        <button
          className={styles.iconBtn}
          onClick={undo}
          disabled={!canUndo()}
          title={`Undo (Ctrl+Z)${past.length ? ` — ${past[past.length - 1]?.label}` : ''}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M3 13C5 7 11 3 18 5" />
          </svg>
        </button>
        <button
          className={styles.iconBtn}
          onClick={redo}
          disabled={!canRedo()}
          title={`Redo (Ctrl+Shift+Z)${future.length ? ` — ${future[0]?.label}` : ''}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6" />
            <path d="M21 13C19 7 13 3 6 5" />
          </svg>
        </button>
      </div>

      <div className={styles.divider} />

      {/* Tools */}
      <div className={styles.toolGroup}>
        <button
          className={`${styles.toolBtn} ${activeTool === 'select' ? styles.active : ''}`}
          onClick={() => setActiveTool('select')}
          title="Select Tool (V)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 4l7 18 3-7 7-3L4 4z" />
          </svg>
          <span>Select</span>
        </button>
        <button
          className={`${styles.toolBtn} ${activeTool === 'blade' ? styles.active : ''}`}
          onClick={() => setActiveTool('blade')}
          title="Blade Tool (B) — Cut clips"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="4" x2="20" y2="20" />
            <line x1="4" y1="20" x2="20" y2="4" />
          </svg>
          <span>Blade</span>
        </button>
        <button
          className={`${styles.toolBtn} ${activeTool === 'hand' ? styles.active : ''}`}
          onClick={() => setActiveTool('hand')}
          title="Hand Tool (H) — Scroll timeline"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v0M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v3" />
            <path d="M18 11a2 2 0 011 4l-3 6H8l-3-5a2 2 0 010-4h13z" />
          </svg>
          <span>Hand</span>
        </button>
      </div>

      <div className={styles.spacer} />

      {/* Right actions */}
      <div className={styles.menuGroup}>
        {/* Storyboard shortcut */}
        {project && (
          <button
            className={styles.menuBtn}
            onClick={() => setActiveTab('storyboard')}
            title="Inspect AI Storyboard scenes"
          >
            🎬 Scenes ({project.scenes.length})
          </button>
        )}

        {/* Logs button */}
        <button
          className={styles.menuBtn}
          onClick={() => setActiveTab('logs')}
          title="View Python backend logs"
        >
          📜 Logs
          {logs.length > 0 && <span className={styles.logsBadge}>{logs.length}</span>}
        </button>

        <button
          className={styles.menuBtn}
          onClick={() => setShowKeyboardHelp(true)}
          title="Keyboard Shortcuts (?)"
        >
          ? Help
        </button>

        {isRendering ? (
          <div className={styles.exportProgressContainer} title={renderStage || 'Rendering...'}>
            <div className={styles.exportProgressInfo}>
              <span className={styles.exportSpin}>⚡</span>
              <span className={styles.exportPercent}>{Math.round(renderProgress)}%</span>
              <span className={styles.exportStage}>{renderStage || 'Rendering 1080p...'}</span>
            </div>
            <div className={styles.exportProgressBar}>
              <div
                className={styles.exportProgressFill}
                style={{ width: `${Math.max(5, renderProgress)}%` }}
              />
            </div>
            <button
              type="button"
              className={styles.cancelExportBtn}
              onClick={cancelRender}
              title="Cancel Video Export"
            >
              ✕ Cancel
            </button>
          </div>
        ) : renderedVideoUrl ? (
          <div className={styles.exportReadyContainer}>
            <a
              href={renderedVideoUrl}
              download
              className={styles.downloadBtn}
              title="Download Broadcast 1080p MP4"
            >
              ⬇ Download MP4
            </a>
            <button
              type="button"
              className={styles.previewBtn}
              onClick={() => setShowExportModal(true)}
              title="Preview Video"
            >
              🎬 Preview
            </button>
            <button
              type="button"
              className={styles.clearExportBtn}
              onClick={resetRender}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className={styles.exportButtonGroup}>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => renderProject()}
              title="Direct 1-Click 1080p Render (No modal dialog needed)"
            >
              🚀 Export Video
            </button>
            <button
              type="button"
              className={styles.exportSettingsBtn}
              onClick={() => setShowExportModal(true)}
              title="Export Settings & Advanced Options"
            >
              ⚙️
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
