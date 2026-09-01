import { useEffect, useState } from 'react'
import { useApi } from '../state/api'

export function AttachmentImage({
  attachmentId,
  mimeType,
  dataBase64,
  alt = '消息图片',
}: {
  attachmentId: string
  mimeType: string
  dataBase64?: string
  alt?: string
}) {
  const api = useApi()
  const [src, setSrc] = useState<string | null>(
    dataBase64 ? `data:${mimeType};base64,${dataBase64}` : null,
  )
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    dataBase64 ? 'ready' : 'loading',
  )

  useEffect(() => {
    if (dataBase64) {
      setSrc(`data:${mimeType};base64,${dataBase64}`)
      setStatus('ready')
      return
    }
    let cancelled = false
    setStatus('loading')
    void api.attachments
      .read(attachmentId)
      .then((bytes) => {
        if (cancelled) return
        setSrc(`data:${bytes.mimeType};base64,${bytes.dataBase64}`)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [api, attachmentId, dataBase64, mimeType])

  if (status === 'error') {
    return <div className="muted">图片无法显示</div>
  }
  if (status === 'loading' || !src) {
    return <div className="muted">加载图片…</div>
  }
  return <img className="message-image" src={src} alt={alt} />
}
