import { useEffect, useRef, useState } from 'react'
import type {
  ChatMessage,
  ConversationDetail,
  ErrorPayload,
  PublicSettings,
  StagedImage,
} from '@shared/types'
import { AnalysisCard } from '../components/AnalysisCard'
import { AttachmentImage } from '../components/AttachmentImage'
import { Composer } from '../components/Composer'
import { StatusBanner } from '../components/StatusBanner'
import { useApi } from '../state/api'

export function ChatPage({
  conversationId,
  settings,
  onConversationChange,
}: {
  conversationId: string | null
  settings: PublicSettings | null
  onConversationChange: (id: string) => void
}) {
  const api = useApi()
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(() => Boolean(conversationId))
  const [error, setError] = useState('')
  const skipLoadForId = useRef<string | null>(null)
  const mountedRef = useRef(true)
  const loadGeneration = useRef(0)
  const pendingIds = useRef(new Set<string>())
  const [, setPendingVersion] = useState(0)
  const conversationIdRef = useRef(conversationId)
  conversationIdRef.current = conversationId

  function setConversationPending(id: string, value: boolean) {
    if (value) pendingIds.current.add(id)
    else pendingIds.current.delete(id)
    setPendingVersion((n) => n + 1)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  function stillCurrent(id: string, generation?: number): boolean {
    if (!mountedRef.current) return false
    if (conversationIdRef.current !== id) return false
    if (generation !== undefined && generation !== loadGeneration.current) return false
    return true
  }

  async function reload(id: string) {
    const generation = ++loadGeneration.current
    try {
      const value = await api.conversations.get(id)
      if (!stillCurrent(id, generation)) return
      setDetail(value)
      setError('')
    } catch (err) {
      if (!stillCurrent(id, generation)) return
      setError(err instanceof Error ? err.message : '无法加载对话')
    }
  }

  useEffect(() => {
    if (!conversationId) {
      setDetail(null)
      setLoading(false)
      return
    }
    if (skipLoadForId.current === conversationId) {
      skipLoadForId.current = null
      setLoading(false)
      return
    }
    skipLoadForId.current = null
    const generation = ++loadGeneration.current
    let cancelled = false
    setLoading(true)
    setError('')
    setDetail((current) => (current?.id === conversationId ? current : null))
    void api.conversations
      .get(conversationId)
      .then((value) => {
        if (!cancelled && stillCurrent(conversationId, generation)) {
          setDetail(value)
          setError('')
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && stillCurrent(conversationId, generation)) {
          setError(err instanceof Error ? err.message : '无法加载对话')
        }
      })
      .finally(() => {
        if (!cancelled && stillCurrent(conversationId, generation)) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [api, conversationId])

  async function startNewConversation() {
    setError('')
    const startedOn = conversationIdRef.current
    try {
      const created = await api.conversations.create()
      if (!mountedRef.current || conversationIdRef.current !== startedOn) return
      skipLoadForId.current = created.id
      conversationIdRef.current = created.id
      onConversationChange(created.id)
      setDetail({ ...created, messages: [] })
      setLoading(false)
    } catch (err) {
      if (!mountedRef.current || conversationIdRef.current !== startedOn) return
      setError(err instanceof Error ? err.message : '无法创建新对话')
    }
  }

  async function send(text: string, images: StagedImage[]) {
    setError('')
    let id = conversationId
    if (!id) {
      const startedOn = conversationIdRef.current
      const created = await api.conversations.create()
      if (!mountedRef.current || conversationIdRef.current !== startedOn) return
      id = created.id
      skipLoadForId.current = id
      conversationIdRef.current = id
      onConversationChange(id)
      setDetail({ ...created, messages: [] })
      setLoading(false)
    }

    const sendForId = id
    const tempId = `pending-${crypto.randomUUID()}`
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId: sendForId,
      role: 'user',
      content: [
        ...(text.trim() ? [{ type: 'text' as const, text }] : []),
        ...images.map((image, index) => ({
          type: 'image' as const,
          attachmentId: `${tempId}-image-${index}`,
          mimeType: image.mimeType,
          originalName: image.name,
          dataBase64: image.dataBase64,
        })),
      ],
      createdAt: new Date().toISOString(),
    }
    if (!stillCurrent(sendForId)) return
    setDetail((current) => ({
      id: sendForId,
      title: current?.title ?? '新对话',
      createdAt: current?.createdAt ?? optimistic.createdAt,
      updatedAt: optimistic.createdAt,
      messages: [...(current?.id === sendForId ? (current.messages ?? []) : []), optimistic],
    }))
    setConversationPending(sendForId, true)
    try {
      const result = await api.messages.send({ conversationId: sendForId, text, images })
      if (!stillCurrent(sendForId)) return
      onConversationChange(result.conversation.id)
      await reload(result.conversation.id)
    } catch (err) {
      if (!stillCurrent(sendForId)) return
      const payload: ErrorPayload = {
        code: 'unknown',
        message: err instanceof Error ? err.message : '发送失败',
        retryable: true,
      }
      setDetail((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((message) =>
                message.id === tempId ? { ...message, error: payload } : message,
              ),
            }
          : current,
      )
    } finally {
      setConversationPending(sendForId, false)
    }
  }

  const configMissing =
    settings && (!settings.aiBaseUrl || !settings.aiModel || !settings.hasAiApiKey)
  const messages = detail?.messages ?? []
  const pending = Boolean(conversationId && pendingIds.current.has(conversationId))

  return (
    <>
      <div className="page">
        <div className="chat-header">
          <strong>{detail?.title ?? '对话'}</strong>
          <button type="button" className="primary" onClick={() => void startNewConversation()}>
            新对话
          </button>
        </div>
        {configMissing ? (
          <StatusBanner>请先到设置中填写 AI 接口地址、模型和 API Key。</StatusBanner>
        ) : null}
        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
        {loading ? <p className="muted">正在加载对话…</p> : null}
        {!loading && !error && !messages.length ? (
          <div className="empty">粘贴一句日语或一张游戏截图，开始学习。</div>
        ) : null}
        <div className="messages">
          {messages.map((message, index) => (
            <MessageView
              key={message.id}
              message={message}
              screenshotId={
                message.role === 'assistant' ? lastScreenshotBefore(messages, index) : undefined
              }
              onRetry={async () => {
                if (message.id.startsWith('pending-')) {
                  const retryText = message.content
                    .filter((part) => part.type === 'text')
                    .map((part) => part.text)
                    .join('\n')
                  const retryImages: StagedImage[] = message.content.flatMap((part) =>
                    part.type === 'image' && part.dataBase64
                      ? [
                          {
                            name: part.originalName || 'image',
                            mimeType: part.mimeType,
                            byteSize: Math.ceil((part.dataBase64.length * 3) / 4),
                            dataBase64: part.dataBase64,
                          },
                        ]
                      : [],
                  )
                  setDetail((current) =>
                    current
                      ? {
                          ...current,
                          messages: current.messages.filter((item) => item.id !== message.id),
                        }
                      : current,
                  )
                  await send(retryText, retryImages)
                  return
                }
                setConversationPending(message.conversationId, true)
                try {
                  await api.messages.retry(message.id)
                  await reload(message.conversationId)
                } finally {
                  setConversationPending(message.conversationId, false)
                }
              }}
              onSaved={async () => {
                await reload(message.conversationId)
              }}
            />
          ))}
          {pending ? (
            <p className="muted" role="status">
              正在分析…
            </p>
          ) : null}
        </div>
      </div>
      <Composer onSend={send} />
    </>
  )
}

function MessageView({
  message,
  screenshotId,
  onRetry,
  onSaved,
}: {
  message: ChatMessage
  screenshotId?: string
  onRetry: () => void
  onSaved: () => Promise<void>
}) {
  if (message.role === 'user') {
    const text = message.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
    const images = message.content.filter((part) => part.type === 'image')
    return (
      <div className="bubble user">
        {text ? <div>{text}</div> : null}
        {images.map((part) =>
          part.type === 'image' ? (
            <AttachmentImage
              key={part.attachmentId}
              attachmentId={part.attachmentId}
              mimeType={part.mimeType}
              dataBase64={part.dataBase64}
              alt={part.originalName || '消息图片'}
            />
          ) : null,
        )}
        {message.error ? (
          <div>
            <p>{message.error.message}</p>
            {message.error.retryable ? (
              <button type="button" className="ghost" onClick={onRetry}>
                重试
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }
  if (message.analysis) {
    return (
      <AnalysisCard
        message={{
          ...message,
          content: screenshotId
            ? [{ type: 'image', attachmentId: screenshotId, mimeType: 'image/png' }]
            : message.content,
        }}
        onSaved={onSaved}
      />
    )
  }
  return (
    <div className="bubble">
      {message.content.map((part) => (part.type === 'text' ? part.text : '')).join(' ')}
    </div>
  )
}

function lastScreenshotBefore(messages: ChatMessage[], assistantIndex: number): string | undefined {
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const found = messages[index].content.find((part) => part.type === 'image')
    if (found && found.type === 'image') return found.attachmentId
  }
  return undefined
}
