import React, { useRef, useState, useCallback } from 'react'
import { useUIStore } from '@/store/useUIStore'
import { useKeyboard } from '@/hooks/useKeyboard'
import { TopMenuBar } from './TopMenuBar'
import { LeftDrawer } from './LeftDrawer'
import { SwapVisualModal } from '@/components/ai/SwapVisualModal'
import { PreviewPlayer } from '@/components/player/PreviewPlayer'
import { PropertiesPanel } from '@/components/properties/PropertiesPanel'
import { TimelinePanel } from '@/components/timeline/TimelinePanel'

export function EditorShell() {
  useKeyboard()

  const {
    leftPanelWidth, rightPanelWidth, timelinePanelHeight,
    setLeftPanelWidth, setRightPanelWidth, setTimelinePanelHeight,
  } = useUIStore()

  // ── Panel resize handlers ──
  const isResizingLeft = useRef(false)
  const isResizingRight = useRef(false)
  const isResizingBottom = useRef(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const startVal = useRef(0)

  const startResizeLeft = useCallback((e: React.MouseEvent) => {
    isResizingLeft.current = true
    startX.current = e.clientX
    startVal.current = leftPanelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftPanelWidth])

  const startResizeRight = useCallback((e: React.MouseEvent) => {
    isResizingRight.current = true
    startX.current = e.clientX
    startVal.current = rightPanelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [rightPanelWidth])

  const startResizeBottom = useCallback((e: React.MouseEvent) => {
    isResizingBottom.current = true
    startY.current = e.clientY
    startVal.current = timelinePanelHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [timelinePanelHeight])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isResizingLeft.current) {
      setLeftPanelWidth(startVal.current + (e.clientX - startX.current))
    }
    if (isResizingRight.current) {
      setRightPanelWidth(startVal.current - (e.clientX - startX.current))
    }
    if (isResizingBottom.current) {
      setTimelinePanelHeight(startVal.current - (e.clientY - startY.current))
    }
  }, [setLeftPanelWidth, setRightPanelWidth, setTimelinePanelHeight])

  const handleMouseUp = useCallback(() => {
    isResizingLeft.current = false
    isResizingRight.current = false
    isResizingBottom.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  return (
    <div
      className="editor-shell"
      style={{
        '--left-width': `${leftPanelWidth}px`,
        '--right-width': `${rightPanelWidth}px`,
        '--timeline-height': `${timelinePanelHeight}px`,
      } as React.CSSProperties}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Menu Bar */}
      <TopMenuBar />

      {/* Left Panel */}
      <div className="editor-left" style={{ position: 'relative' }}>
        <LeftDrawer />
        {/* Resize handle (right edge of left panel) */}
        <div
          className="resize-handle horizontal"
          style={{ right: 0 }}
          onMouseDown={startResizeLeft}
        />
      </div>

      {/* Center Preview */}
      <div className="editor-center">
        <PreviewPlayer />
      </div>

      {/* Right Panel */}
      <div className="editor-right" style={{ position: 'relative' }}>
        {/* Resize handle (left edge of right panel) */}
        <div
          className="resize-handle horizontal"
          style={{ left: 0 }}
          onMouseDown={startResizeRight}
        />
        <PropertiesPanel />
      </div>

      {/* Bottom Timeline */}
      <div className="editor-bottom" style={{ position: 'relative' }}>
        {/* Resize handle (top edge of timeline) */}
        <div
          className="resize-handle vertical"
          style={{ top: 0 }}
          onMouseDown={startResizeBottom}
        />
        <TimelinePanel />
      </div>

      {/* Modal for swapping scene visuals */}
      <SwapVisualModal />
    </div>
  )
}
