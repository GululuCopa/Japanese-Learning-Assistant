import type { SpeakResult } from '@shared/types'

export async function playSpeakResult(result: SpeakResult, speed: 0.75 | 1): Promise<void> {
  const bytes = Uint8Array.from(atob(result.dataBase64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType }))
  const audio = new Audio(url)
  audio.playbackRate = speed
  audio.onended = () => URL.revokeObjectURL(url)
  await audio.play()
}
