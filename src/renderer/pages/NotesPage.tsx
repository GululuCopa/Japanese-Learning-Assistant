import { useEffect, useState } from 'react'
import type { NoteKind, NoteRecord } from '@shared/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StatusBanner } from '../components/StatusBanner'
import { useApi } from '../state/api'

const TABS: Array<{ kind: NoteKind; label: string }> = [
  { kind: 'word', label: '单词' },
  { kind: 'sentence', label: '句子' },
  { kind: 'grammar', label: '文法' },
]

export function NotesPage() {
  const api = useApi()
  const [kind, setKind] = useState<NoteKind>('word')
  const [query, setQuery] = useState('')
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [selected, setSelected] = useState<NoteRecord | null>(null)
  const [pendingDelete, setPendingDelete] = useState<NoteRecord | null>(null)
  const [exportMessage, setExportMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function refresh(nextKind = kind, nextQuery = query) {
    setLoading(true)
    try {
      const list = await api.notes.list({ kind: nextKind, query: nextQuery })
      setNotes(list)
      if (selected) {
        setSelected(list.find((note) => note.id === selected.id) ?? list[0] ?? null)
      } else {
        setSelected(list[0] ?? null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void api.notes.list({ kind, query }).then((list) => {
      if (cancelled) return
      setNotes(list)
      setSelected(list[0] ?? null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [api, kind, query])

  return (
    <div className="page">
      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            className={kind === tab.kind ? 'primary' : 'ghost'}
            onClick={() => {
              setKind(tab.kind)
              setSelected(null)
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault()
          void refresh(kind, query)
        }}
      >
        <input
          type="text"
          value={query}
          placeholder="搜索笔记"
          aria-label="搜索笔记"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="ghost" type="submit">
          搜索
        </button>
      </form>
      {errorMessage ? <StatusBanner tone="error">{errorMessage}</StatusBanner> : null}
      {exportMessage ? <StatusBanner>{exportMessage}</StatusBanner> : null}
      {loading ? <p className="muted">加载中…</p> : null}
      {!loading && notes.length === 0 ? <div className="empty">没有找到笔记。</div> : null}
      <div className="list">
        {notes.map((note) => (
          <button key={note.id} type="button" onClick={() => setSelected(note)}>
            <strong>{note.title}</strong>
            <div className="muted">{note.translation || String(note.payload.reading || '')}</div>
          </button>
        ))}
      </div>
      {selected ? (
        <article className="card" style={{ marginTop: 16 }}>
          <h2>{selected.title}</h2>
          <p className="muted">
            {String(selected.payload.reading || selected.payload.meaning || '')}
          </p>
          {selected.kind === 'word' && Array.isArray(selected.payload.meaning) ? (
            <p>{(selected.payload.meaning as string[]).join(' / ')}</p>
          ) : null}
          {selected.originalSentence ? <p>原句：{selected.originalSentence}</p> : null}
          {selected.translation ? <p>{selected.translation}</p> : null}
          <div className="toolbar">
            <button
              type="button"
              className="primary"
              onClick={async () => {
                const result = await api.notes.exportToObsidian(selected.id)
                setErrorMessage('')
                setExportMessage(result.message)
              }}
            >
              导出到 Obsidian
            </button>
            <button type="button" className="danger" onClick={() => setPendingDelete(selected)}>
              删除
            </button>
          </div>
        </article>
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="删除笔记"
          message={`确定删除「${pendingDelete.title}」吗？如果该笔记已导出，当前配置的 Obsidian Vault 中对应的 Markdown 文件也会被删除。此操作不可恢复。`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void (async () => {
              try {
                const result = await api.notes.delete(pendingDelete.id)
                setPendingDelete(null)
                setSelected(null)
                setErrorMessage('')
                setExportMessage(result.message)
                await refresh()
              } catch (error) {
                setPendingDelete(null)
                setExportMessage('')
                setErrorMessage(error instanceof Error ? error.message : '删除失败')
              }
            })()
          }}
        />
      ) : null}
    </div>
  )
}
