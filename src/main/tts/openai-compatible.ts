import fs from 'node:fs'
import path from 'node:path'
import { audioCacheKey } from './cache'
import type { TTSProvider } from '@shared/contracts'
import { ProviderError } from '@shared/errors'
import type { AudioResult, TTSOptions } from '@shared/types'
import { joinUrl } from '../ai/openai-compatible'

export interface OpenAICompatibleTTSOptions {
  baseUrl: string
  apiKey: string
  model: string
  voice: string
  cacheDir: string
  fetchImpl?: typeof fetch
}

export { audioCacheKey }

export class OpenAICompatibleTTSProvider implements TTSProvider {
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: OpenAICompatibleTTSOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async speak(text: string, options?: TTSOptions): Promise<AudioResult> {
    const trimmed = text.trim()
    if (!trimmed) {
      throw new ProviderError('invalid_response', '没有可朗读的文本', false)
    }
    if (!this.options.baseUrl || !this.options.apiKey || !this.options.model) {
      throw new ProviderError('configuration', 'TTS provider is not configured', false)
    }

    const model = options?.model || this.options.model
    const voice = options?.voice || this.options.voice || 'alloy'
    const key = audioCacheKey({
      provider: 'openai-compatible',
      model,
      voice,
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
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          voice,
          input: trimmed,
          response_format: 'mp3',
        }),
      })
    } catch {
      throw new ProviderError('network', '无法连接 TTS 服务', true)
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('authentication', 'TTS 服务认证失败', false)
    }
    if (response.status === 429) {
      throw new ProviderError('rate_limit', 'TTS 服务请求过于频繁', true)
    }
    if (!response.ok) {
      throw new ProviderError('unknown', `TTS 服务返回 HTTP ${response.status}`, true)
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    const tempPath = path.join(this.options.cacheDir, `${key}.tmp`)
    fs.writeFileSync(tempPath, bytes)
    fs.renameSync(tempPath, filePath)
    return { mimeType: 'audio/mpeg', bytes, cached: false }
  }
}
