import React from 'react'
import { useUIStore } from '@/store/useUIStore'
import styles from './KeyboardShortcutsModal.module.css'

const SHORTCUTS = [
  { group: 'Playback', items: [
    ['Space', 'Play / Pause'],
    ['K', 'Pause'],
    ['J', 'Rewind 2×'],
    ['L', 'Fast Forward 2×'],
    ['←', 'Step 1 frame back'],
    ['→', 'Step 1 frame forward'],
    ['Shift+←', 'Jump -10 frames'],
    ['Shift+→', 'Jump +10 frames'],
  ]},
  { group: 'Tools', items: [
    ['V', 'Select Tool'],
    ['B', 'Blade / Cut Tool'],
    ['H', 'Hand / Scroll Tool'],
  ]},
  { group: 'Edit', items: [
    ['Ctrl+Z', 'Undo'],
    ['Ctrl+Shift+Z', 'Redo'],
    ['Ctrl+C', 'Copy'],
    ['Ctrl+V', 'Paste'],
    ['Delete', 'Remove selected clip'],
  ]},
  { group: 'Timeline', items: [
    ['+', 'Zoom In'],
    ['-', 'Zoom Out'],
    ['I', 'Set In Point'],
    ['O', 'Set Out Point'],
    ['M', 'Add Marker'],
  ]},
  { group: 'Project', items: [
    ['Ctrl+S', 'Save Project'],
    ['Ctrl+E', 'Export'],
    ['?', 'Show this help'],
  ]},
]

export function KeyboardShortcutsModal() {
  const { setShowKeyboardHelp } = useUIStore()

  return (
    <div className={styles.backdrop} onClick={() => setShowKeyboardHelp(false)}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Keyboard Shortcuts</h2>
          <button className={styles.closeBtn} onClick={() => setShowKeyboardHelp(false)}>✕</button>
        </div>
        <div className={styles.body}>
          {SHORTCUTS.map(({ group, items }) => (
            <div key={group} className={styles.group}>
              <div className={styles.groupTitle}>{group}</div>
              {items.map(([key, label]) => (
                <div key={key} className={styles.shortcutRow}>
                  <span className={styles.key}>{key}</span>
                  <span className={styles.shortcutLabel}>{label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
