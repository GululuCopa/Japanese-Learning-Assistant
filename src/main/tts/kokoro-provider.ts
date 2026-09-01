import fs from 'node:fs'
import path from 'node:path'
import type { TTSProvider } from '@shared/contracts'
import { KOKORO_MODEL } from '@shared/constants'
import { ProviderError } from '@shared/errors'
import { kokoroVoiceForGender, normalizeVoiceGender } from '@shared/tts'
import type { AudioResult, TTSOptions, VoiceGender } from '@shared/types'
import { joinUrl } from '../ai/openai-compatible'
import { audioCacheKey } from './cache'

export interface KokoroTTSOptions {
  baseUrl: string
  voiceGender: VoiceGender
  cacheDir: string
  fetchImpl?: typeof fetch
}

export class KokoroTTSProvider implements TTSProvider {
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: KokoroTTSOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async speak(text: string, options?: TTSOptions): Promise<AudioResult> {
    const trimmed = text.trim()
    if (!trimmed) {
      throw new ProviderError('invalid_response', '没有可朗读的文本', false)
    }
    if (!this.options.baseUrl) {
      throw new ProviderError('configuration', '本地语音引擎尚未就绪。', false)
    }

    const voiceGender = normalizeVoiceGender(options?.voiceGender ?? this.options.voiceGender)
    const voice = options?.voice || kokoroVoiceForGender(voiceGender)
    const speed = options?.speed ?? 1
    const model = options?.model || KOKORO_MODEL
    const key = audioCacheKey({
      provider: 'kokoro-local',
      model,
      voice,
      voiceGender,
      speed,
      text: trimmed,
    })
    fs.mkdirSync(this.options.cacheDir, { recursive: true })
    const filePath = path.join(this.options.cacheDir, `${key}.mp3`)
    if (fs.existsSync(filePath)) {
      return {
        mimeType: 'audio/mpeg',
        bytes: fs.readFileSync(filePath),
        cached: true,
      }
    }

    const url = joinUrl(this.options.baseUrl, '/audio/speech')
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          voice,
          input: trimmed,
          response_format: 'mp3',
          speed,
        }),
      })
    } catch {
      throw new ProviderError('network', '无法连接本地 Kokoro 语音引擎，请确认引擎已启动。', true)
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('authentication', '本地语音引擎拒绝了请求。', false)
    }
    if (response.status === 429) {
      throw new ProviderError('rate_limit', '本地语音引擎繁忙，请稍后再试。', true)
    }
    if (!response.ok) {
      throw new ProviderError('unknown', `本地语音引擎返回 HTTP ${response.status}`, true)
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength === 0) {
      throw new ProviderError('invalid_response', '本地语音引擎返回了空音频。', true)
    }
    const tempPath = path.join(this.options.cacheDir, `${key}.tmp`)
    fs.writeFileSync(tempPath, bytes)
    fs.renameSync(tempPath, filePath)
    return { mimeType: 'audio/mpeg', bytes, cached: false }
  }
}
