import React, { useCallback } from 'react'
import { usePlayerStore } from '@/store/usePlayerStore'
import { useUIStore } from '@/store/useUIStore'
import styles from './PlayerControls.module.css'

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const f = Math.floor((seconds % 1) * 30)
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`
}

export function PlayerControls() {
  const {
    currentTime, duration, isPlaying,
    volume, isMuted, playbackRate,
    play, pause, seek,
    setVolume, setMuted, setPlaybackRate,
    stepFrames,
  } = usePlayerStore()
  const { showSafeZones, setShowSafeZones } = useUIStore()

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value))
  }, [seek])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value))
    setMuted(false)
  }, [setVolume, setMuted])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const rates = [0.25, 0.5, 1, 1.5, 2, 4]

  return (
    <div className={styles.controls}>
      {/* Seek Bar */}
      <div className={styles.seekRow}>
        <span className={styles.timecode}>{formatTime(currentTime)}</span>
        <div className={styles.seekWrap}>
          <input
            type="range"
            className={styles.seekBar}
            min={0}
            max={duration || 100}
            step={1 / 30}
            value={currentTime}
            onChange={handleSeekChange}
          />
          <div className={styles.seekFill} style={{ width: `${progress}%` }} />
        </div>
        <span className={styles.timecode}>{formatTime(duration)}</span>
      </div>

      {/* Control Row */}
      <div className={styles.controlRow}>
        {/* Left: transport */}
        <div className={styles.transport}>
          <button className={styles.btn} onClick={() => seek(0)} title="Go to Start">
            ⏮
          </button>
          <button className={styles.btn} onClick={() => stepFrames(-1)} title="Step Back 1 Frame (←)">
            ⏪
          </button>
          <button
            className={`${styles.btn} ${styles.playBtn}`}
            onClick={isPlaying ? pause : play}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className={styles.btn} onClick={() => stepFrames(1)} title="Step Forward 1 Frame (→)">
            ⏩
          </button>
          <button className={styles.btn} onClick={() => seek(duration)} title="Go to End">
            ⏭
          </button>
        </div>

        {/* Center: speed */}
        <div className={styles.speedGroup}>
          {rates.map(r => (
            <button
              key={r}
              className={`${styles.speedBtn} ${playbackRate === r ? styles.active : ''}`}
              onClick={() => setPlaybackRate(r)}
              title={`${r}× speed`}
            >
              {r}×
            </button>
          ))}
        </div>

        {/* Right: volume + safe zones */}
        <div className={styles.rightGroup}>
          <button
            className={styles.btn}
            onClick={() => setMuted(!isMuted)}
            title="Toggle Mute"
          >
            {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            className={styles.volumeBar}
            min={0} max={1} step={0.01}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
          />
          <button
            className={`${styles.btn} ${showSafeZones ? styles.active : ''}`}
            onClick={() => setShowSafeZones(!showSafeZones)}
            title="Toggle Safe Zones"
          >⊞</button>
        </div>
      </div>
    </div>
  )
}
