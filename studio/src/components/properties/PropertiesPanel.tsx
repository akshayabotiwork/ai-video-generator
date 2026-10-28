import React from 'react'
import { useTimelineStore } from '@/store/useTimelineStore'
import { useUIStore } from '@/store/useUIStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import { useAIProjectStore } from '@/store/useAIProjectStore'
import { ClipProperties } from './ClipProperties'
import styles from './PropertiesPanel.module.css'

export function PropertiesPanel() {
  const { selectedClipIds, timeline } = useTimelineStore()
  const { rightPanelTab, setRightPanelTab } = useUIStore()

  // Find selected clip
  const selectedClip = selectedClipIds.length === 1
    ? timeline.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipIds[0])
    : undefined

  const tabs = [
    { id: 'properties', label: 'Properties' },
    { id: 'color', label: 'Color' },
    { id: 'effects', label: 'Effects' },
    { id: 'transitions', label: 'Transitions' },
  ] as const

  return (
    <div className={styles.panel}>
      <div className="panel-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`panel-tab ${rightPanelTab === t.id ? 'active' : ''}`}
            onClick={() => setRightPanelTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      <div className="panel-scroll">
        {!selectedClip && (
          <div className={styles.noSelection}>
            <div className={styles.noSelIcon}>🎬</div>
            <p>Select a clip to edit properties</p>
          </div>
        )}

        {selectedClip && rightPanelTab === 'properties' && (
          <ClipProperties clip={selectedClip} />
        )}

        {selectedClip && rightPanelTab === 'color' && (
          <ColorGradingPanel clip={selectedClip} />
        )}

        {rightPanelTab === 'effects' && (
          <EffectsPanel clip={selectedClip} />
        )}

        {rightPanelTab === 'transitions' && (
          <TransitionsPanel clip={selectedClip} />
        )}
      </div>
    </div>
  )
}

// ── Inline sub-panels ──

function ColorGradingPanel({ clip }: { clip?: any }) {
  const { updateClip } = useTimelineStore()
  if (!clip || clip.type !== 'video') return (
    <div className={styles.noSelection} style={{marginTop:24}}>
      <p>Select a video clip to color grade</p>
    </div>
  )

  const filters = clip.filters || {}
  const update = (key: string, val: number) => {
    updateClip(clip.id, { filters: { ...filters, [key]: val } })
  }

  const PRESETS = [
    { id: 'none', label: 'None' }, { id: 'cinematic', label: '🎥 Cinematic' },
    { id: 'news', label: '📰 News' }, { id: 'warm', label: '🌅 Warm' },
    { id: 'film', label: '🎞️ Film' }, { id: 'bw', label: '🖤 B&W' },
    { id: 'vintage', label: '📺 Vintage' },
  ]

  return (
    <div className={styles.section}>
      <div className="section-header">Color Presets</div>
      <div className={styles.presetGrid}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            className={`${styles.presetBtn} ${filters.preset === p.id ? styles.activePreset : ''}`}
            onClick={() => updateClip(clip.id, { filters: { ...filters, preset: p.id } })}
          >{p.label}</button>
        ))}
      </div>

      <div className="section-header" style={{marginTop: 12}}>Manual Adjust</div>
      {[
        ['Brightness', 'brightness', -100, 100],
        ['Contrast', 'contrast', -100, 100],
        ['Saturation', 'saturation', -100, 100],
        ['Hue', 'hue', 0, 360],
        ['Temperature', 'temperature', -100, 100],
      ].map(([label, key, min, max]) => (
        <div key={key as string} className={styles.sliderRow}>
          <span className={styles.sliderLabel}>{label}</span>
          <input
            type="range"
            min={min as number} max={max as number} step={1}
            value={filters[key as string] ?? 0}
            onChange={e => update(key as string, parseFloat(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.sliderVal}>{filters[key as string] ?? 0}</span>
        </div>
      ))}
    </div>
  )
}

function EffectsPanel({ clip }: { clip?: any }) {
  const { updateClip } = useTimelineStore()
  const { pushHistory } = useHistoryStore()

  if (!clip) return (
    <div className={styles.noSelection} style={{ marginTop: 24 }}>
      <p>Select a clip to apply effects</p>
    </div>
  )

  const MOTION_MAP: Record<string, string> = {
    'Static': 'static',
    'Ken Burns In': 'zoom_in',
    'Ken Burns Out': 'zoom_out',
    'Slow Pan Left': 'pan_left',
    'Slow Pan Right': 'pan_right',
  }

  return (
    <div className={styles.section}>
      <div className="section-header">Motion Presets</div>
      <div className={styles.presetGrid}>
        {['Static', 'Ken Burns In', 'Ken Burns Out', 'Slow Pan Left', 'Slow Pan Right'].map(m => {
          const val = MOTION_MAP[m] || 'static'
          const isActive = clip.motion === val
          return (
            <button
              key={m}
              className={`${styles.presetBtn} ${isActive ? styles.activePreset : ''}`}
              onClick={() => {
                pushHistory('Apply motion')
                updateClip(clip.id, { motion: val } as any)
                const match = clip.id.match(/^clip-v-(\d+)$/)
                if (match) {
                  const scId = parseInt(match[1], 10)
                  useAIProjectStore.getState().updateScene(scId, { motion_style: val })
                }
              }}
            >{m}</button>
          )
        })}
      </div>
      <div className="section-header" style={{ marginTop: 12 }}>Filters</div>
      <div className={styles.presetGrid}>
        {['Blur', 'Sharpen', 'Vignette', 'Grain', 'Glow'].map(f => {
          const isActive = clip.effect === f
          return (
            <button
              key={f}
              className={`${styles.presetBtn} ${isActive ? styles.activePreset : ''}`}
              onClick={() => {
                pushHistory('Apply effect')
                updateClip(clip.id, { effect: isActive ? undefined : f } as any)
              }}
            >{f}</button>
          )
        })}
      </div>
    </div>
  )
}

function TransitionsPanel({ clip }: { clip?: any }) {
  const { updateClip } = useTimelineStore()
  const { pushHistory } = useHistoryStore()

  if (!clip) return (
    <div className={styles.noSelection} style={{ marginTop: 24 }}>
      <p>Select a clip to apply transitions</p>
    </div>
  )

  const TRANSITIONS = [
    { id: 'fade', icon: '🌊', label: 'Crossfade' },
    { id: 'wipe_left', icon: '◀', label: 'Wipe Left' },
    { id: 'wipe_right', icon: '▶', label: 'Wipe Right' },
    { id: 'slide_left', icon: '⬅', label: 'Slide Left' },
    { id: 'slide_right', icon: '➡', label: 'Slide Right' },
    { id: 'circlecrop', icon: '⭕', label: 'Circle Iris' },
    { id: 'dissolve', icon: '✨', label: 'Dissolve' },
    { id: 'zoom_in', icon: '🔍', label: 'Zoom In' },
    { id: 'fade_black', icon: '⬛', label: 'Fade Black' },
    { id: 'fade_white', icon: '⬜', label: 'Fade White' },
    { id: 'cut', icon: '✂️', label: 'Cut' },
  ]

  const currentTrans = clip.transition?.type

  return (
    <div className={styles.section}>
      <div className="section-header">Apply Transition</div>
      <div className={styles.transitionGrid}>
        {TRANSITIONS.map(t => {
          const isActive = currentTrans === t.id
          return (
            <button
              key={t.id}
              className={`${styles.transBtn} ${isActive ? styles.activeTrans : ''}`}
              title={t.label}
              onClick={() => {
                pushHistory('Apply transition')
                const newTrans = isActive ? undefined : { type: t.id as any, duration: 0.5, position: 'end' as const }
                updateClip(clip.id, {
                  transition: newTrans
                } as any)
                const match = clip.id.match(/^clip-v-(\d+)$/)
                if (match) {
                  const scId = parseInt(match[1], 10)
                  const normType = t.id.replace('_', '')
                  useAIProjectStore.getState().updateScene(scId, {
                    transition_type: isActive ? 'fade' : normType,
                    transition_duration: 0.5
                  })
                }
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
