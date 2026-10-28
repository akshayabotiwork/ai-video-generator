import React from 'react'
import { useAIProjectStore } from '@/store/useAIProjectStore'
import { SCRIPT_PRESETS } from '@/types/aiProject'
import styles from './ScriptDirectorPanel.module.css'

export function ScriptDirectorPanel() {
  const {
    scriptText, setScriptText,
    projectTitle, setProjectTitle,
    category, setCategory,
    theme, setTheme,
    voice, setVoice,
    aspectRatio, setAspectRatio,
    serpApiKey, setSerpApiKey,
    maxShotDuration, setMaxShotDuration,
    isParsing, parseScript, loadPreset,
    logs, setActiveTab
  } = useAIProjectStore()

  const words = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0
  const liveLogsRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll the live terminal to latest line during generation
  React.useEffect(() => {
    if (isParsing && liveLogsRef.current) {
      liveLogsRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length, isParsing])

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.title}>
            <span>📝</span>
            <span>AI Director & Script</span>
          </div>
          <span className={styles.badge}>AI ENGINE</span>
        </div>
        <span className={styles.subtitle}>
          Paste your news story or script in any language for automatic voiceover & video generation
        </span>
      </div>

      {/* Presets */}
      <div className={styles.presetSection}>
        <span className={styles.sectionLabel}>Quick Presets</span>
        <div className={styles.presetChips}>
          {SCRIPT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={styles.presetBtn}
              onClick={() => loadPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Title */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Project Title</label>
        <input
          type="text"
          className={styles.input}
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          placeholder="e.g. Breaking News Report"
        />
      </div>

      {/* Script Text */}
      <div className={styles.formGroup}>
        <div className={styles.label}>
          <span>Raw Script / Story</span>
          <span className={styles.wordCount}>{words} words (~{Math.round(words / 2.5)}s)</span>
        </div>
        <textarea
          className={styles.textarea}
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          placeholder="Paste or write your full news story here..."
        />
      </div>

      {/* Category & Theme */}
      <div className={styles.row2}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Category</label>
          <select
            className={styles.select}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="news">Global Breaking News</option>
            <option value="sports">Sports & Cricket</option>
            <option value="tech">Technology & AI</option>
            <option value="business">Business & Markets</option>
            <option value="politics">Politics & Wire</option>
            <option value="history">Historical & Doc</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Visual Theme</label>
          <select
            className={styles.select}
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="breaking_news">Breaking News (Red/White)</option>
            <option value="sports_center">Sports Central (Orange/Gold)</option>
            <option value="tech_pulse">Tech Pulse (Cyan/Slate)</option>
            <option value="financial_wire">Financial Wire (Navy/Green)</option>
            <option value="documentary">Doc & History (Amber)</option>
          </select>
        </div>
      </div>

      {/* Voice & Format */}
      <div className={styles.row2}>
        <div className={styles.formGroup}>
          <label className={styles.label}>AI Voice (TTS)</label>
          <select
            className={styles.select}
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
          >
            <option value="hi-IN-MadhurNeural">Hindi (Madhur / Male)</option>
            <option value="hi-IN-SwaraNeural">Hindi (Swara / Female)</option>
            <option value="en-US-GuyNeural">English (Guy / Male)</option>
            <option value="en-US-AriaNeural">English (Aria / Female)</option>
            <option value="gu-IN-NiranjanNeural">Gujarati (Niranjan / Male)</option>
            <option value="gu-IN-DhwaniNeural">Gujarati (Dhwani / Female)</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Aspect Ratio</label>
          <select
            className={styles.select}
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
          >
            <option value="16:9">📺 16:9 Landscape (TV/YT)</option>
            <option value="9:16">📱 9:16 Portrait (Shorts/Reels)</option>
          </select>
        </div>
      </div>

      {/* Max shot duration */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          <span>Max Shot Duration</span>
          <span className={styles.wordCount}>Split cuts per scene</span>
        </label>
        <div className={styles.sliderRow}>
          <input
            type="range"
            min="2.0"
            max="8.0"
            step="0.5"
            className={styles.slider}
            value={maxShotDuration}
            onChange={(e) => setMaxShotDuration(parseFloat(e.target.value))}
          />
          <span className={styles.sliderVal}>{maxShotDuration.toFixed(1)}s</span>
        </div>
      </div>

      {/* Optional SERP Key */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          <span>SERP API Key</span>
          <span className={styles.wordCount}>(Optional)</span>
        </label>
        <input
          type="password"
          className={styles.input}
          value={serpApiKey}
          onChange={(e) => setSerpApiKey(e.target.value)}
          placeholder="Pre-configured on backend"
        />
      </div>

      {/* Action Button */}
      <button
        type="button"
        className={styles.generateBtn}
        disabled={isParsing || !scriptText.trim()}
        onClick={() => parseScript()}
      >
        {isParsing ? (
          <>
            <span className={styles.spinner} />
            <span>AI Synthesizing Storyboard & Timeline...</span>
          </>
        ) : (
          <>
            <span>✨</span>
            <span>Generate Storyboard & Timeline</span>
          </>
        )}
      </button>

      {/* Live System Process Monitor */}
      {(isParsing || (logs.length > 0 && isParsing !== false && words > 0)) && (
        <div className={styles.liveLogBox}>
          <div className={styles.liveLogHeader}>
            <div className={styles.liveLogTitle}>
              <span className={styles.liveLogDot} />
              <span>LIVE SYSTEM LOGS STREAM</span>
            </div>
            <button
              type="button"
              className={styles.viewFullLogsBtn}
              onClick={() => setActiveTab('logs')}
            >
              Open Full Logs ↗
            </button>
          </div>
          <div className={styles.liveLogEntries}>
            {logs.slice(-10).map((l, i) => (
              <div key={l.id ? `live_${l.id}` : i} className={styles.liveLogRow}>
                <span className={styles.liveLogSrc}>[{l.source}]</span>
                <span className={`${styles.liveLogLvl} ${styles[`lvl_${l.level}`] || ''}`}>
                  [{l.level}]
                </span>
                <span className={styles.liveLogText}>{l.message}</span>
              </div>
            ))}
            <div ref={liveLogsRef} />
          </div>
        </div>
      )}
    </div>
  )
}
