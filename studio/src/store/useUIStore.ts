import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

type RightPanelTab = 'properties' | 'effects' | 'color' | 'audio' | 'transitions'
type LeftPanelTab = 'media' | 'text' | 'transitions' | 'music'

interface UIState {
  leftPanelTab: LeftPanelTab
  rightPanelTab: RightPanelTab
  leftPanelWidth: number
  rightPanelWidth: number
  timelinePanelHeight: number
  showKeyboardHelp: boolean
  showExportModal: boolean
  showProjectSettings: boolean
  previewZoom: number     // 0.5, 1, 1.5, 2 (fit = 0)
  showSafeZones: boolean
  darkMode: boolean
  isRendering: boolean
  renderProgress: number   // 0–100
  renderStatus: string

  setLeftPanelTab: (tab: LeftPanelTab) => void
  setRightPanelTab: (tab: RightPanelTab) => void
  setLeftPanelWidth: (w: number) => void
  setRightPanelWidth: (w: number) => void
  setTimelinePanelHeight: (h: number) => void
  setShowKeyboardHelp: (v: boolean) => void
  setShowExportModal: (v: boolean) => void
  setShowProjectSettings: (v: boolean) => void
  setPreviewZoom: (z: number) => void
  setShowSafeZones: (v: boolean) => void
  setRendering: (v: boolean, progress?: number, status?: string) => void
}

export const useUIStore = create<UIState>()(
  immer((set) => ({
    leftPanelTab: 'media',
    rightPanelTab: 'properties',
    leftPanelWidth: 420,
    rightPanelWidth: 280,
    timelinePanelHeight: 220,
    showKeyboardHelp: false,
    showExportModal: false,
    showProjectSettings: false,
    previewZoom: 0,   // 0 = fit
    showSafeZones: false,
    darkMode: true,
    isRendering: false,
    renderProgress: 0,
    renderStatus: '',

    setLeftPanelTab: (tab) => set(s => { s.leftPanelTab = tab }),
    setRightPanelTab: (tab) => set(s => { s.rightPanelTab = tab }),
    setLeftPanelWidth: (w) => set(s => { s.leftPanelWidth = Math.min(700, Math.max(180, w)) }),
    setRightPanelWidth: (w) => set(s => { s.rightPanelWidth = Math.min(420, Math.max(180, w)) }),
    setTimelinePanelHeight: (h) => set(s => { s.timelinePanelHeight = Math.min(500, Math.max(120, h)) }),
    setShowKeyboardHelp: (v) => set(s => { s.showKeyboardHelp = v }),
    setShowExportModal: (v) => set(s => { s.showExportModal = v }),
    setShowProjectSettings: (v) => set(s => { s.showProjectSettings = v }),
    setPreviewZoom: (z) => set(s => { s.previewZoom = z }),
    setShowSafeZones: (v) => set(s => { s.showSafeZones = v }),
    setRendering: (v, progress = 0, status = '') => set(s => {
      s.isRendering = v; s.renderProgress = progress; s.renderStatus = status
    }),
  }))
)
