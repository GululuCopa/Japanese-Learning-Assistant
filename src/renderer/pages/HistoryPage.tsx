import { useEffect, useState } from 'react'
import type { ConversationSummary } from '@shared/types'
import { useApi } from '../state/api'

export function HistoryPage({ onOpen }: { onOpen: (conversationId: string) => void }) {
  const api = useApi()
  const [items, setItems] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api.conversations.list().then((list) => {
      setItems(list)
      setLoading(false)
    })
  }, [api])

  return (
    <div className="page">
      {loading ? <p className="muted">正在加载历史…</p> : null}
      {!loading && items.length === 0 ? <div className="empty">还没有历史对话。</div> : null}
      <div className="list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="history-item"
            onClick={() => onOpen(item.id)}
          >
            <strong>{item.title}</strong>
            <div className="muted">{new Date(item.updatedAt).toLocaleString()}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
