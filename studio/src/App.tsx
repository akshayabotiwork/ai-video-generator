import React from 'react'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { EditorShell } from '@/components/layout/EditorShell'
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal'
import { ExportModal } from '@/components/export/ExportModal'
import { useUIStore } from '@/store/useUIStore'
import '@/styles/globals.css'
import '@/styles/editor.css'
import '@/styles/animations.css'

export default function App() {
  const { showKeyboardHelp, showExportModal } = useUIStore()

  return (
    <ErrorBoundary>
      <EditorShell />
      {showKeyboardHelp && <KeyboardShortcutsModal />}
      {showExportModal && <ExportModal />}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-1)',
            border: '1px solid var(--border)',
            fontSize: '13px',
          },
        }}
      />
    </ErrorBoundary>
  )
}
