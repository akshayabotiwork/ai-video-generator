import React from 'react'
import { useAIProjectStore } from '@/store/useAIProjectStore'
import type { VisualCandidate } from '@/types/aiProject'
import styles from './SwapVisualModal.module.css'

export function SwapVisualModal() {
  const {
    swapModalSceneId,
    swapModalShotIndex,
    swapModalClipId,
    modalSearchQuery,
    modalCandidates,
    isSearchingModal,
    closeSwapModal,
    setModalSearchQuery,
    searchModalMedia,
    selectCandidateForScene,
  } = useAIProjectStore()

  if (swapModalSceneId === null) return null

  const handleSelect = (candidate: VisualCandidate) => {
    selectCandidateForScene(swapModalSceneId, candidate, swapModalShotIndex, swapModalClipId)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchModalMedia()
    }
  }

  return (
    <div className={styles.backdrop} onClick={closeSwapModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.title}>
            <span>🖼️</span>
            <span>
              Select / Swap Visual for Scene {swapModalSceneId}
              {(swapModalShotIndex ?? 0) > 0 ? ` (Part ${swapModalShotIndex + 1})` : ''}
            </span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={closeSwapModal}>
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className={styles.searchBar}>
          <input
            type="text"
            className={styles.searchInput}
            value={modalSearchQuery}
            onChange={(e) => setModalSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search SERP Google Images for this scene..."
          />
          <button
            type="button"
            className={styles.searchBtn}
            disabled={isSearchingModal}
            onClick={() => searchModalMedia()}
          >
            {isSearchingModal ? 'Searching...' : '🔍 Search'}
          </button>
        </div>

        {/* Candidate Visuals Grid */}
        <div className={styles.grid}>
          {modalCandidates.length === 0 ? (
            <div className={styles.emptyGrid}>
              <span style={{ fontSize: '28px' }}>🔎</span>
              <p>No candidate visuals found</p>
              <span style={{ fontSize: '11px' }}>
                Enter a search query above to discover news photos via SERP API.
              </span>
            </div>
          ) : (
            modalCandidates.map((c, idx) => (
              <div
                key={idx}
                className={styles.candidateCard}
                onClick={() => handleSelect(c)}
                title="Click to apply to scene"
              >
                <div className={styles.cardImgWrap}>
                  <img
                    src={c.thumbnail_url || c.image_url}
                    alt={c.title}
                    className={styles.cardImg}
                    loading="lazy"
                  />
                  {c.source && <span className={styles.cardSource}>{c.source}</span>}
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardTitle}>{c.title || 'Image Result'}</span>
                  <span className={styles.cardSub}>Click to apply</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
