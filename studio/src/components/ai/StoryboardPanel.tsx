import React, { useState } from 'react'
import { useAIProjectStore, toMediaUrl } from '@/store/useAIProjectStore'
import { usePlayerStore } from '@/store/usePlayerStore'
import styles from './StoryboardPanel.module.css'

export function StoryboardPanel() {
  const {
    project,
    activeSceneId,
    setActiveSceneId,
    setActiveTab,
    openSwapModal,
    updateScene,
    syncToTimeline,
  } = useAIProjectStore()

  const { seek } = usePlayerStore()

  // Local state for narration edits before saving/resynthesizing
  const [editingNarration, setEditingNarration] = useState<{ [sceneId: number]: string }>({})

  if (!project || !project.scenes || project.scenes.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🎬</div>
        <p>No Storyboard Generated Yet</p>
        <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
          Write or select a script in the Script tab to generate AI scenes, audio, and visuals.
        </span>
        <button
          type="button"
          className={styles.emptyBtn}
          onClick={() => setActiveTab('script')}
        >
          Go to Script Tab
        </button>
      </div>
    )
  }

  const handleSceneClick = (sceneId: number, start: number) => {
    setActiveSceneId(sceneId)
    seek(start)
  }

  return (
    <div className={styles.container}>
      {/* Top summary & sync button */}
      <div className={styles.topBar}>
        <div className={styles.summary}>
          <span className={styles.summaryTitle}>{project.title}</span>
          <span className={styles.summaryMeta}>
            🎬 {project.scenes.length} Scenes | ⏱️ {(project.total_timeline_duration || 0).toFixed(1)}s
          </span>
        </div>
        <button
          type="button"
          className={styles.syncBtn}
          onClick={() => syncToTimeline()}
          title="Push AI scenes to Multi-Track timeline"
        >
          <span>🔄</span>
          <span>Sync to Timeline</span>
        </button>
      </div>

      {/* Scene cards */}
      <div className={styles.sceneList}>
        {project.scenes.map((sc, index) => {
          const isActive = activeSceneId === sc.scene_id
          const isLast = index === project.scenes.length - 1
          const nextScene = !isLast ? project.scenes[index + 1] : null
          const sceneImages: string[] = []
          if (sc.all_media_paths && sc.all_media_paths.length > 0) {
            sc.all_media_paths.forEach(p => {
              const u = toMediaUrl(p)
              if (u && !sceneImages.includes(u)) sceneImages.push(u)
            })
          }
          const prim = toMediaUrl(sc.local_media_path)
          if (prim && !sceneImages.includes(prim)) sceneImages.unshift(prim)
          if (sc.selected_visual?.image_url) {
            const u = sc.selected_visual.image_url
            if (u && !sceneImages.includes(u)) sceneImages.push(u)
          }
          if (sceneImages.length === 0) {
            sceneImages.push('https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=300&q=80')
          }

          const sceneDur = Math.max((sc.timeline_end || 3) - (sc.timeline_start || 0), 1.0)
          const maxShotDur = Math.max(1.5, project.max_shot_duration || 3.0)
          const threshold = maxShotDur * 0.5
          const fullShots = Math.floor(sceneDur / maxShotDur)
          const remainder = Math.round((sceneDur - (fullShots * maxShotDur)) * 1000) / 1000

          let shotDurs: number[] = []
          if (sceneDur > maxShotDur) {
            if (remainder >= threshold) {
              shotDurs = Array(fullShots).fill(maxShotDur).concat([remainder])
            } else {
              if (fullShots > 1) {
                shotDurs = Array(fullShots - 1).fill(maxShotDur).concat([Math.round((maxShotDur + remainder) * 1000) / 1000])
              } else {
                shotDurs = [sceneDur]
              }
            }
          } else {
            shotDurs = [sceneDur]
          }

          const currentNarration = editingNarration[sc.scene_id] !== undefined
            ? editingNarration[sc.scene_id]
            : sc.narration_text

          return (
            <React.Fragment key={sc.scene_id}>
              <div
                className={`${styles.sceneCard} ${isActive ? styles.active : ''}`}
                onClick={() => handleSceneClick(sc.scene_id, sc.timeline_start || 0)}
              >
                {/* Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.sceneNum}>
                    <span className={styles.sceneBadge}>SCENE {sc.scene_id}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                      {sc.primary_entity || 'Visual'}
                    </span>
                  </div>
                  <span className={styles.sceneTime}>
                    {(sc.timeline_start || 0).toFixed(1)}s – {(sc.timeline_end || 3).toFixed(1)}s ({sceneDur.toFixed(1)}s)
                  </span>
                </div>

                {/* Preview & headline */}
                <div className={styles.previewRow}>
                  {/* Visual Thumbnails with Swap button for each sub-shot */}
                  <div className={styles.thumbsGroup}>
                    {shotDurs.map((sDur, shotIdx) => {
                      const shotImg = (sc.all_media_paths && sc.all_media_paths[shotIdx])
                        ? toMediaUrl(sc.all_media_paths[shotIdx])
                        : (sceneImages[shotIdx] || sceneImages[shotIdx % sceneImages.length])
                      const clipId = shotDurs.length === 1 ? `clip-v-${sc.scene_id}` : `clip-v-${sc.scene_id}-${shotIdx + 1}`
                      return (
                        <div
                          key={shotIdx}
                          className={styles.thumbWrap}
                          title={`Part ${shotIdx + 1} (${sDur.toFixed(1)}s) - Click to swap`}
                          onClick={(e) => {
                            e.stopPropagation()
                            openSwapModal(sc.scene_id, shotIdx, clipId)
                          }}
                        >
                          <img src={shotImg} alt={`Scene ${sc.scene_id} Part ${shotIdx + 1}`} className={styles.thumb} />
                          {shotDurs.length > 1 && (
                            <span className={styles.shotBadge}>P{shotIdx + 1} ({sDur.toFixed(1)}s)</span>
                          )}
                          <div className={styles.swapOverlay}>
                            <span>🔍</span>
                            <span>Swap</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Overlays / Headline inputs */}
                  <div className={styles.infoWrap}>
                    <input
                      type="text"
                      className={styles.headlineInput}
                      value={sc.lower_third_headline || ''}
                      placeholder="Lower Third Headline..."
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        updateScene(sc.scene_id, { lower_third_headline: e.target.value })
                      }}
                    />
                    <div className={styles.tagRow}>
                      <input
                        type="text"
                        className={styles.tagInput}
                        value={sc.category_tag || ''}
                        placeholder="Tag (e.g. BREAKING)"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          updateScene(sc.scene_id, { category_tag: e.target.value })
                        }}
                      />
                      {sc.visual_category && (
                        <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          🎬 {sc.visual_category.replace('_', ' ')}
                        </span>
                      )}
                      {sc.chapter_marker && (
                        <span style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          🏷️ {sc.chapter_marker}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Narration voiceover text */}
                <div className={styles.narrationWrap}>
                  <div className={styles.narrationLabel}>
                    <span>🎙️ Voiceover Narration</span>
                    {editingNarration[sc.scene_id] !== undefined &&
                      editingNarration[sc.scene_id] !== sc.narration_text && (
                        <button
                          type="button"
                          className={styles.reVoiceBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            updateScene(sc.scene_id, { narration_text: editingNarration[sc.scene_id] })
                          }}
                        >
                          ⚡ Re-synthesize Speech
                        </button>
                      )}
                  </div>
                  <textarea
                    className={styles.narrationInput}
                    value={currentNarration}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setEditingNarration({
                        ...editingNarration,
                        [sc.scene_id]: e.target.value,
                      })
                    }}
                    onBlur={() => {
                      if (
                        editingNarration[sc.scene_id] !== undefined &&
                        editingNarration[sc.scene_id] !== sc.narration_text
                      ) {
                        updateScene(sc.scene_id, { narration_text: editingNarration[sc.scene_id] })
                      }
                    }}
                  />
                </div>

                {/* Motion Style & Transition controls */}
                <div className={styles.controlsRow}>
                  <div className={styles.controlItem}>
                    <label className={styles.controlLabel}>Motion Effect</label>
                    <select
                      className={styles.controlSelect}
                      value={sc.motion_style || 'zoom_in'}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        updateScene(sc.scene_id, { motion_style: e.target.value })
                      }}
                    >
                      <option value="zoom_in">🔍 Ken Burns: Zoom In</option>
                      <option value="zoom_out">🔎 Ken Burns: Zoom Out</option>
                      <option value="pan_left">⬅️ Pan Left</option>
                      <option value="pan_right">➡️ Pan Right</option>
                      <option value="static">⏸️ Static</option>
                    </select>
                  </div>

                  <div className={styles.controlItem}>
                    <label className={styles.controlLabel}>Transition to Next</label>
                    <select
                      className={styles.controlSelect}
                      value={sc.transition_type || 'fade'}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        updateScene(sc.scene_id, { transition_type: e.target.value })
                      }}
                    >
                      <option value="fade">🌊 Crossfade (Broadcast)</option>
                      <option value="wipeleft">◀ Wipe Left</option>
                      <option value="wiperight">▶ Wipe Right</option>
                      <option value="slideleft">⬅ Slide Left</option>
                      <option value="slideright">➡ Slide Right</option>
                      <option value="circlecrop">⭕ Circle Iris</option>
                      <option value="dissolve">✨ Dissolve</option>
                      <option value="zoomin">🔍 Zoom In</option>
                      <option value="fadeblack">⬛ Fade Black</option>
                      <option value="fadewhite">⬜ Fade White</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* In-Between Transition Bridge */}
              {!isLast && nextScene && (
                <div className={styles.transitionBridge}>
                  <div className={styles.bridgeLine} />
                  <div className={styles.bridgeContent}>
                    <div className={styles.bridgeHeader}>
                      <span className={styles.bridgeIcon}>⚡</span>
                      <span className={styles.bridgeTitle}>
                        Transition: Scene {sc.scene_id} ➔ Scene {nextScene.scene_id}
                      </span>
                    </div>
                    <div className={styles.bridgeControls}>
                      <select
                        className={styles.bridgeSelect}
                        value={sc.transition_type || 'fade'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          updateScene(sc.scene_id, { transition_type: e.target.value })
                        }}
                        title="Transition between these scenes"
                      >
                        <option value="fade">🌊 Crossfade</option>
                        <option value="wipeleft">◀ Wipe Left</option>
                        <option value="wiperight">▶ Wipe Right</option>
                        <option value="slideleft">⬅ Slide Left</option>
                        <option value="slideright">➡ Slide Right</option>
                        <option value="circlecrop">⭕ Circle Iris</option>
                        <option value="dissolve">✨ Dissolve</option>
                        <option value="zoomin">🔍 Zoom In</option>
                        <option value="fadeblack">⬛ Fade Black</option>
                        <option value="fadewhite">⬜ Fade White</option>
                      </select>

                      <select
                        className={styles.bridgeDurSelect}
                        value={sc.transition_duration || 0.5}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          updateScene(sc.scene_id, { transition_duration: parseFloat(e.target.value) })
                        }}
                        title="Transition Duration"
                      >
                        <option value={0.3}>0.3s</option>
                        <option value={0.5}>0.5s</option>
                        <option value={0.8}>0.8s</option>
                        <option value={1.0}>1.0s</option>
                      </select>

                      <button
                        type="button"
                        className={styles.bridgePreviewBtn}
                        title="Live preview this transition in monitor"
                        onClick={(e) => {
                          e.stopPropagation()
                          const previewTime = Math.max(0, (sc.timeline_end || 3) - (sc.transition_duration || 0.5) - 0.4)
                          seek(previewTime)
                          usePlayerStore.getState().play()
                        }}
                      >
                        ▶ Preview
                      </button>
                    </div>
                  </div>
                  <div className={styles.bridgeLine} />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
