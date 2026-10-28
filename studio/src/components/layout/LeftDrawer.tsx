import React from 'react'
import { useAIProjectStore, type AIStudioTab } from '@/store/useAIProjectStore'
import { ScriptDirectorPanel } from '@/components/ai/ScriptDirectorPanel'
import { StoryboardPanel } from '@/components/ai/StoryboardPanel'
import { SystemLogsPanel } from '@/components/ai/SystemLogsPanel'
import { MediaPanel } from '@/components/media/MediaPanel'
import { ProjectSettingsPanel } from '@/components/settings/ProjectSettingsPanel'
import styles from './LeftDrawer.module.css'

export function LeftDrawer() {
  const { activeTab, setActiveTab, project, logs } = useAIProjectStore()

  const tabs: { id: AIStudioTab; label: string; icon: string; badge?: number }[] = [
    { id: 'script', label: 'Script', icon: '📝' },
    { id: 'storyboard', label: 'Scenes', icon: '🎬', badge: project?.scenes?.length },
    { id: 'media', label: 'Media', icon: '🖼️' },
    { id: 'logs', label: 'Logs', icon: '📜', badge: logs.length > 0 ? logs.length : undefined },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div className={styles.drawer}>
      {/* Icon Navigation Bar */}
      <nav className={styles.tabNav}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tabBtn} ${activeTab === t.id ? styles.active : ''}`}
            onClick={() => setActiveTab(t.id)}
            title={t.label}
          >
            <span className={styles.tabIcon}>{t.icon}</span>
            <span className={styles.tabLabel}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Pane Content */}
      <div className={styles.contentArea}>
        {activeTab === 'script' && <ScriptDirectorPanel />}
        {activeTab === 'storyboard' && <StoryboardPanel />}
        {activeTab === 'media' && <MediaPanel />}
        {activeTab === 'logs' && <SystemLogsPanel />}
        {activeTab === 'settings' && <ProjectSettingsPanel />}
      </div>
    </div>
  )
}
