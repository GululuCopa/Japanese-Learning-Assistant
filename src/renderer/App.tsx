import { useEffect, useState } from 'react'
import type { PublicSettings } from '@shared/types'
import { ChatPage } from './pages/ChatPage'
import { HistoryPage } from './pages/HistoryPage'
import { NotesPage } from './pages/NotesPage'
import { SettingsPage } from './pages/SettingsPage'
import { useApi } from './state/api'

type Page = 'chat' | 'notes' | 'history' | 'settings'

export function App() {
  const api = useApi()
  const [page, setPage] = useState<Page>('chat')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [settings, setSettings] = useState<PublicSettings | null>(null)

  useEffect(() => {
    void api.settings.get().then(setSettings)
  }, [api])

  return (
    <div className="app-shell">
      <nav className="nav" aria-label="主导航">
        <h1>Japanese Assistant</h1>
        <NavButton current={page} id="chat" label="对话" onClick={setPage} />
        <NavButton current={page} id="notes" label="笔记" onClick={setPage} />
        <NavButton current={page} id="history" label="历史" onClick={setPage} />
        <NavButton current={page} id="settings" label="设置" onClick={setPage} />
      </nav>
      <main className="main">
        <div className="route-panel" hidden={page !== 'chat'} aria-hidden={page !== 'chat'}>
          <ChatPage
            conversationId={conversationId}
            settings={settings}
            onConversationChange={setConversationId}
          />
        </div>
        {page === 'notes' ? (
          <div className="route-panel">
            <NotesPage />
          </div>
        ) : null}
        {page === 'history' ? (
          <div className="route-panel">
            <HistoryPage
              onOpen={(id) => {
                setConversationId(id)
                setPage('chat')
              }}
            />
          </div>
        ) : null}
        {page === 'settings' ? (
          <div className="route-panel">
            <SettingsPage onSaved={setSettings} />
          </div>
        ) : null}
      </main>
    </div>
  )
}

function NavButton({
  current,
  id,
  label,
  onClick,
}: {
  current: Page
  id: Page
  label: string
  onClick: (page: Page) => void
}) {
  return (
    <button type="button" className={current === id ? 'active' : ''} onClick={() => onClick(id)}>
      <span>{label}</span>
    </button>
  )
}
