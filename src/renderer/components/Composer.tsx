import {
  useMemo,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_MESSAGE } from '@shared/constants'
import { detectImageMime } from '@shared/image'
import type { StagedImage } from '@shared/types'
import { useApi } from '../state/api'

interface Preview extends StagedImage {
  previewUrl: string
}

export function Composer({
  disabled,
  onSend,
}: {
  disabled?: boolean
  onSend: (text: string, images: StagedImage[]) => Promise<void>
}) {
  const api = useApi()
  const [text, setText] = useState('')
  const [images, setImages] = useState<Preview[]>([])
  const [error, setError] = useState('')
  const [dropActive, setDropActive] = useState(false)
  const canSend = useMemo(() => text.trim().length > 0 || images.length > 0, [text, images])

  async function addFiles(files: File[]) {
    setError('')
    const next = [...images]
    for (const file of files) {
      if (next.length >= MAX_IMAGES_PER_MESSAGE) {
        setError(`每条消息最多 ${MAX_IMAGES_PER_MESSAGE} 张图片`)
        break
      }
      const buffer = new Uint8Array(await file.arrayBuffer())
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        setError(`${file.name || '图片'} 超过 10 MiB`)
        continue
      }
      const mime = detectImageMime(buffer)
      if (!mime) {
        setError('只支持 PNG、JPEG 或 WebP 图片')
        continue
      }
      let binary = ''
      buffer.forEach((byte) => {
        binary += String.fromCharCode(byte)
      })
      const dataBase64 = btoa(binary)
      next.push({
        name: file.name || `image-${next.length + 1}`,
        mimeType: mime,
        byteSize: buffer.byteLength,
        dataBase64,
        previewUrl: URL.createObjectURL(new Blob([buffer], { type: mime })),
      })
    }
    setImages(next)
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.items)
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (files.length) {
      event.preventDefault()
      await addFiles(files)
    }
  }

  async function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault()
    setDropActive(false)
    await addFiles(Array.from(event.dataTransfer.files))
  }

  async function pickNative() {
    try {
      const picked = await api.attachments.pickImages()
      await addFiles(
        picked.map(
          (item) =>
            new File([Uint8Array.from(atob(item.dataBase64), (c) => c.charCodeAt(0))], item.name, {
              type: item.mimeType,
            }),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法添加图片')
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!canSend || disabled) return
    const payload = images.map(({ previewUrl: _previewUrl, ...image }) => image)
    const outgoingText = text
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl))
    setText('')
    setImages([])
    try {
      await onSend(outgoingText, payload)
    } catch {
      setText(outgoingText)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <form
      className={`composer ${dropActive ? 'drop-active' : ''}`}
      onSubmit={submit}
      onDragOver={(event) => {
        event.preventDefault()
        setDropActive(true)
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={handleDrop}
    >
      {images.length ? (
        <div className="previews">
          {images.map((image, index) => (
            <div className="preview" key={`${image.name}-${index}`}>
              <img src={image.previewUrl} alt={image.name} />
              <button
                type="button"
                aria-label={`移除 ${image.name}`}
                onClick={() => {
                  URL.revokeObjectURL(image.previewUrl)
                  setImages(images.filter((_, current) => current !== index))
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <div className="muted">{error}</div> : null}
      <div className="composer-row">
        <button
          type="button"
          className="ghost"
          onClick={() => void pickNative()}
          aria-label="选择图片"
        >
          +
        </button>
        <textarea
          value={text}
          placeholder="粘贴日语、截图，或直接提问…"
          onChange={(event) => setText(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={onKeyDown}
          aria-label="消息输入"
        />
        <button className="primary" disabled={!canSend || disabled} type="submit">
          发送
        </button>
      </div>
    </form>
  )
}
