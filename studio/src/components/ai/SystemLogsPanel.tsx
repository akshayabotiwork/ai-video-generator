import React, { useEffect, useState, useRef } from 'react'
import { useAIProjectStore } from '@/store/useAIProjectStore'
import styles from './SystemLogsPanel.module.css'

export function SystemLogsPanel() {
  const { logs, fetchLogs, clearLogs } = useAIProjectStore()
  const [levelFilter, setLevelFilter] = useState<string>('ALL')
  const [autoScroll, setAutoScroll] = useState<boolean>(true)
  const streamEndRef = useRef<HTMLDivElement>(null)

  // Live polling every 500ms when panel is open
  useEffect(() => {
    fetchLogs()
    const timer = setInterval(() => {
      fetchLogs()
    }, 500)
    return () => clearInterval(timer)
  }, [fetchLogs])

  // Auto-scroll to latest log entry
  useEffect(() => {
    if (autoScroll && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length, autoScroll])

  const filtered = logs.filter(
    (l) => levelFilter === 'ALL' || l.level.toUpperCase() === levelFilter
  )

  const handleExport = () => {
    window.open('/api/system-logs/export', '_blank')
  }

  return (
    <div className={styles.container}>
      {/* Header bar */}
      <div className={styles.topBar}>
        <div className={styles.title}>
          <span>📜</span>
          <span>System Engine Logs</span>
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} />
            LIVE
          </span>
        </div>
        <div className={styles.actions}>
          <label className={styles.scrollLabel} title="Keep latest logs in view">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <span>Auto</span>
          </label>
          <select
            className={styles.filterSelect}
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <option value="ALL">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
          <button type="button" className={styles.btn} onClick={handleExport} title="Download text logs">
            📥 Export
          </button>
          <button type="button" className={styles.btn} onClick={clearLogs} title="Clear logs">
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Log stream */}
      <div className={styles.logStream}>
        {filtered.length === 0 ? (
          <div style={{ color: '#6e7681', textAlign: 'center', padding: '20px 0' }}>
            No logs recorded yet. Action triggers (script parsing, media search, TTS, rendering) will appear here live.
          </div>
        ) : (
          filtered.map((l, idx) => (
            <div key={l.id ? `log_${l.id}` : idx} className={styles.logEntry}>
              <span className={styles.logTime}>
                {l.timestamp ? (l.timestamp.includes('T') ? l.timestamp.split('T')[1]?.substring(0, 8) : l.timestamp) : ''}
              </span>
              <span className={`${styles.logLevel} ${styles[`level_${l.level}`] || ''}`}>
                [{l.level}]
              </span>
              <span className={styles.logSource}>[{l.source}]</span>
              <span className={styles.logMsg}>{l.message}</span>
            </div>
          ))
        )}
        <div ref={streamEndRef} />
      </div>
    </div>
  )
}
