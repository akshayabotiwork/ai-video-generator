import React, { useCallback } from 'react'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import { useMediaStore } from '@/store/useMediaStore'
import { useTimelineStore } from '@/store/useTimelineStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import type { MediaAsset } from '@/types/project'
import type { VideoClip, AudioClip } from '@/types/clip'
import { DEFAULT_COLOR_FILTERS } from '@/types/clip'
import styles from './MediaPanel.module.css'

export function MediaPanel() {
  const { assets, filterType, searchQuery, setFilterType, setSearchQuery, addAsset, selectAsset, selectedAssetId, filteredAssets } = useMediaStore()
  const { timeline, addClipToTrack } = useTimelineStore()
  const { pushHistory } = useHistoryStore()

  // Import files via file picker
  const handleImport = useCallback(async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      const blobUrl = URL.createObjectURL(file)
      const name = (file.name || '').toLowerCase()
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(name)
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v|wmv)$/i.test(name)
      const type: MediaAsset['type'] = isVideo ? 'video' : isAudio ? 'audio' : 'image'

      let duration: number | undefined
      if (type === 'video' || type === 'audio') {
        duration = await getMediaDuration(blobUrl, isAudio)
      }

      let finalSrc = blobUrl
      try {
        const b64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.onerror = reject
          r.readAsDataURL(file)
        })
        const uploadResp = await fetch('/api/upload-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, data: b64 }),
        })
        if (uploadResp.ok) {
          const upData = await uploadResp.json()
          if (upData.url) finalSrc = upData.url
        }
      } catch (err) {
        console.warn('Media upload fallback to blob:', err)
      }

      const asset: MediaAsset = {
        id: nanoid(), name: file.name, type, src: finalSrc,
        duration, size: file.size, addedAt: new Date().toISOString(),
      }
      addAsset(asset)
      selectAsset(asset.id)
    }
    toast.success(`Imported ${files.length} file(s)`)
  }, [addAsset, selectAsset])

  // Drop asset onto video/audio track
  const addToTimeline = useCallback((asset: MediaAsset) => {
    const isAudio = asset.type === 'audio'
    let track: Track | undefined

    if (isAudio) {
      // 1. First audio layer (A1)
      const firstAudioTrack = timeline.tracks.find(
        t => t.type === 'audio' && t.id !== 'track-custom-audio' && !t.name.toLowerCase().includes('custom')
      ) || timeline.tracks.find(t => t.type === 'audio')

      // 2. Custom audio layer (above music)
      const customAudioTrack = timeline.tracks.find(
        t => t.id === 'track-custom-audio' || t.name.toLowerCase().includes('custom audio')
      ) || timeline.tracks.filter(t => t.type === 'audio')[1]

      // 3. Music layer
      const musicTrack = timeline.tracks.find(t => t.type === 'music')

      // Priority logic:
      // - If first audio layer is completely empty -> use first audio layer
      // - Else if custom audio layer is empty -> use custom audio layer
      // - Else (if custom audio also has clips) -> use music layer below it
      if (firstAudioTrack && firstAudioTrack.clips.length === 0) {
        track = firstAudioTrack
      } else if (customAudioTrack && customAudioTrack.clips.length === 0) {
        track = customAudioTrack
      } else if (musicTrack) {
        track = musicTrack
      } else {
        track = customAudioTrack || firstAudioTrack || musicTrack
      }
    } else {
      track = timeline.tracks.find(t => t.type === 'video')
    }

    if (!track) { toast.error('No suitable track found'); return }

    // When adding audio to music track:
    // If music track only contains default ambient bed, replace it so user's audio starts at 0!
    let startTime = 0
    if (isAudio && track.type === 'music') {
      const nonAmbientClips = track.clips.filter(c => c.id !== 'clip-m-ambient')
      if (nonAmbientClips.length === 0) {
        // Remove default ambient soundbed clip
        const ambientClip = track.clips.find(c => c.id === 'clip-m-ambient')
        if (ambientClip) {
          useTimelineStore.getState().removeClip(ambientClip.id)
        }
        startTime = 0
      } else {
        startTime = nonAmbientClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
      }
    } else {
      startTime = track.clips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0)
    }

    if (asset.type === 'video' || asset.type === 'image') {
      const clipDuration = asset.duration ?? 5
      const clip: VideoClip = {
        id: nanoid(), trackId: track.id, type: 'video',
        name: asset.name, src: asset.src,
        startTime, duration: clipDuration,
        fileStart: 0, fileEnd: clipDuration,
        originalDuration: clipDuration,
        filters: DEFAULT_COLOR_FILTERS, speed: 1, opacity: 1,
      }
      pushHistory(asset.type === 'image' ? 'Add image clip' : 'Add video clip')
      addClipToTrack(track.id, clip)
    } else if (asset.type === 'audio') {
      const isMusicTrack = track.type === 'music'
      const clipDuration = asset.duration ?? 30
      const clip: AudioClip = {
        id: nanoid(), trackId: track.id, type: isMusicTrack ? 'music' : 'audio',
        name: asset.name, src: asset.src,
        startTime, duration: clipDuration,
        fileStart: 0, fileEnd: clipDuration,
        originalDuration: clipDuration,
        volume: 1,
        fadeIn: isMusicTrack ? 0.5 : 0.05,
        fadeOut: isMusicTrack ? 0.5 : 0.05,
        pan: 0,
        muted: false,
      }
      pushHistory(isMusicTrack ? 'Add music clip' : 'Add audio clip')
      addClipToTrack(track.id, clip)
    }
    toast.success(`Added "${asset.name}" to ${track.name || track.type} track`)
  }, [timeline.tracks, addClipToTrack, pushHistory])

  // Drag-over for drop zone
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleImport(e.dataTransfer.files)
  }, [handleImport])

  const shown = filteredAssets()

  return (
    <div className={styles.panel}>
      {/* Filter tabs */}
      <div className={styles.filterTabs}>
        {(['all','video','audio','image'] as const).map(f => (
          <button
            key={f}
            className={`${styles.filterTab} ${filterType === f ? styles.active : ''}`}
            onClick={() => setFilterType(f)}
          >
            {f === 'all' ? '⊞ All' : f === 'video' ? '🎥' : f === 'audio' ? '🔊' : '🖼'}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className={styles.searchBox}>
        <input
          type="text"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Drop zone */}
      <div
        className={styles.dropzone}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => {
          const inp = document.createElement('input')
          inp.type = 'file'
          inp.accept = 'video/*,audio/*,image/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.mp4,.mov,.webm,.jpg,.jpeg,.png,.webp'
          inp.multiple = true
          inp.onchange = () => handleImport(inp.files)
          inp.click()
        }}
      >
        <span className={styles.dropIcon}>+</span>
        <span className={styles.dropText}>Import Media</span>
        <span className={styles.dropHint}>Drop files or click</span>
      </div>

      {/* Asset Grid */}
      <div className={styles.assetGrid}>
        {shown.length === 0 && (
          <div className={styles.emptyAssets}>
            <p>No media yet</p>
            <p>Import video, audio, or images</p>
          </div>
        )}
        {shown.map(asset => (
          <div
            key={asset.id}
            className={`${styles.assetCard} ${selectedAssetId === asset.id ? styles.active : ''}`}
            title={`${asset.name} (Click to preview, double-click to add)`}
            onClick={() => selectAsset(asset.id)}
            onDoubleClick={() => addToTimeline(asset)}
          >
            <div className={styles.assetThumb}>
              {asset.type === 'image' && asset.src ? (
                <img src={asset.src} alt={asset.name} className={styles.thumbImg} />
              ) : asset.type === 'video' && asset.src ? (
                <video src={asset.src} className={styles.thumbImg} muted preload="metadata" />
              ) : (
                <div className={styles.thumbIcon}>
                  {asset.type === 'video' ? '🎥' : asset.type === 'audio' ? '🔊' : '🖼'}
                </div>
              )}
            </div>
            <div className={styles.assetInfo}>
              <span className={styles.assetName}>{asset.name}</span>
              {asset.duration && (
                <span className={styles.assetDur}>{asset.duration.toFixed(1)}s</span>
              )}
            </div>
            <button
              className={styles.addBtn}
              onClick={(e) => {
                e.stopPropagation()
                addToTimeline(asset)
              }}
              title="Add to Timeline"
            >+</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Helper: get media duration safely with timeout fallback so it never hangs
function getMediaDuration(src: string, isAudio = false): Promise<number> {
  return new Promise(resolve => {
    const el = document.createElement(isAudio ? 'audio' : 'video')
    el.preload = 'metadata'
    let finished = false
    const finish = (dur: number) => {
      if (!finished) {
        finished = true
        el.onloadedmetadata = null
        el.onerror = null
        resolve(dur && !isNaN(dur) && isFinite(dur) && dur > 0 ? dur : (isAudio ? 30 : 5))
      }
    }
    const timer = setTimeout(() => finish(isAudio ? 30 : 5), 1500)
    el.onloadedmetadata = () => {
      clearTimeout(timer)
      finish(el.duration)
    }
    el.onerror = () => {
      clearTimeout(timer)
      finish(isAudio ? 30 : 5)
    }
    el.src = src
  })
}
