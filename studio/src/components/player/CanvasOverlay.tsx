import React, { useEffect, useRef, useCallback } from 'react'
import * as fabric from 'fabric'
import styles from './CanvasOverlay.module.css'

interface Props {
  videoRef?: React.RefObject<HTMLVideoElement | null>
  containerRef?: React.RefObject<HTMLDivElement | null>
}

export function CanvasOverlay({ videoRef, containerRef }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)

  // Init Fabric.js canvas
  useEffect(() => {
    if (!canvasElRef.current) return
    const canvas = new fabric.Canvas(canvasElRef.current, {
      selection: true,
      preserveObjectStacking: true,
      backgroundColor: 'transparent',
    })
    fabricRef.current = canvas

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
  }, [])

  // Sync canvas size to container or video
  useEffect(() => {
    const target = containerRef?.current || videoRef?.current
    if (!target) return

    const resize = () => {
      const c = fabricRef.current
      if (!c || !target) return
      const rect = target.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        c.setDimensions({ width: rect.width, height: rect.height })
        c.renderAll()
      }
    }

    const observer = new ResizeObserver(resize)
    observer.observe(target)
    resize()
    return () => observer.disconnect()
  }, [containerRef, videoRef])

  // ── Toolbar actions ──
  const addText = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    const txt = new fabric.IText('Double-click to edit', {
      left: c.getWidth() / 2,
      top: c.getHeight() / 2,
      originX: 'center',
      originY: 'center',
      fontSize: 36,
      fontFamily: 'Inter, sans-serif',
      fill: '#FFFFFF',
      fontWeight: 'bold',
      shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: 8, offsetX: 2, offsetY: 2 }),
    })
    c.add(txt)
    c.setActiveObject(txt)
    c.renderAll()
  }, [])

  const addRect = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    const rect = new fabric.Rect({
      left: c.getWidth() / 2 - 100,
      top: c.getHeight() / 2 - 40,
      width: 200,
      height: 80,
      fill: 'rgba(91, 110, 245, 0.4)',
      stroke: '#5B6EF5',
      strokeWidth: 2,
      rx: 8,
      ry: 8,
    })
    c.add(rect)
    c.setActiveObject(rect)
    c.renderAll()
  }, [])

  const addLowerThird = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    const w = c.getWidth()
    const h = c.getHeight()
    // Background bar
    const bar = new fabric.Rect({
      left: 0,
      top: h * 0.75,
      width: w * 0.55,
      height: h * 0.12,
      fill: 'rgba(91, 110, 245, 0.9)',
      selectable: false,
    })
    // Name text
    const name = new fabric.IText('Name Here', {
      left: 16,
      top: h * 0.76,
      fontSize: Math.max(14, h * 0.05),
      fontFamily: 'Inter, sans-serif',
      fontWeight: '700',
      fill: '#FFFFFF',
    })
    // Title text
    const title = new fabric.IText('Title / Role', {
      left: 16,
      top: h * 0.76 + h * 0.055,
      fontSize: Math.max(10, h * 0.028),
      fontFamily: 'Inter, sans-serif',
      fill: 'rgba(255,255,255,0.75)',
    })
    const grp = new fabric.Group([bar, name, title], { left: 0, top: h * 0.74 })
    c.add(grp)
    c.setActiveObject(grp)
    c.renderAll()
  }, [])

  const deleteSelected = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    const objs = c.getActiveObjects()
    c.remove(...objs)
    c.discardActiveObject()
    c.renderAll()
  }, [])

  const bringForward = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    const obj = c.getActiveObject()
    if (obj) {
      c.bringObjectForward(obj)
      c.renderAll()
    }
  }, [])

  const sendBackward = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    const obj = c.getActiveObject()
    if (obj) {
      c.sendObjectBackwards(obj)
      c.renderAll()
    }
  }, [])

  return (
    <>
      {/* Fabric canvas wrapped in dedicated isolated container */}
      <div className={styles.canvasWrapper}>
        <canvas ref={canvasElRef} className={styles.overlayCanvas} />
      </div>

      {/* Canvas Toolbar (floats above player) */}
      <div className={styles.canvasToolbar}>
        <button type="button" className={styles.toolBtn} onClick={addText} title="Add Text (T)">
          <span>T</span> Text
        </button>
        <button type="button" className={styles.toolBtn} onClick={addLowerThird} title="Lower Third">
          <span>⬛</span> Lower Third
        </button>
        <button type="button" className={styles.toolBtn} onClick={addRect} title="Add Shape">
          <span>▭</span> Shape
        </button>
        <div className={styles.sep} />
        <button type="button" className={styles.toolBtn} onClick={bringForward} title="Bring Forward">
          ↑
        </button>
        <button type="button" className={styles.toolBtn} onClick={sendBackward} title="Send Backward">
          ↓
        </button>
        <div className={styles.sep} />
        <button
          type="button"
          className={`${styles.toolBtn} ${styles.danger}`}
          onClick={deleteSelected}
          title="Delete Selected (Del)"
        >
          🗑
        </button>
      </div>
    </>
  )
}
