import fs from 'node:fs'
import path from 'node:path'
import type { TTSProvider } from '@shared/contracts'
import { MINIMAX_TIMEOUT_MS } from '@shared/constants'
import { ProviderError } from '@shared/errors'
import { normalizeVoiceGender } from '@shared/tts'
import type { AudioResult, MiniMaxRegion, TTSOptions } from '@shared/types'
import { audioCacheKey } from './cache'

export interface MiniMaxTTSOptions {
  endpoint: string
  region: MiniMaxRegion
  model: string
  femaleVoice: string
  maleVoice: string
  apiKey: string
  cacheDir: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  randomId?: () => string
}

export class MiniMaxTTSProvider implements TTSProvider {
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly randomId: () => string

  constructor(private readonly options: MiniMaxTTSOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? MINIMAX_TIMEOUT_MS
    this.randomId = options.randomId ?? (() => crypto.randomUUID())
  }

  async speak(text: string, options?: TTSOptions): Promise<AudioResult> {
    const trimmed = text.trim()
    if (!trimmed) {
      throw new ProviderError('invalid_response', '没有可朗读的文本', false)
    }

    const voiceGender = normalizeVoiceGender(options?.voiceGender)
    const voice = voiceGender === 'male' ? this.options.maleVoice : this.options.femaleVoice
    const cachePath = this.cachePath(voice, trimmed)
    if (fs.existsSync(cachePath)) {
      return {
        mimeType: 'audio/mpeg',
        bytes: fs.readFileSync(cachePath),
        cached: true,
      }
    }

    const response = await this.request(trimmed, voice)
    if (!response.ok) {
      throw httpStatusError(response.status)
    }
    const payload = await readJson(response)
    const statusCode = miniMaxStatus(payload)
    if (statusCode !== 0) {
      throw mappedMiniMaxError(statusCode ?? 1)
    }
    const hex = audioHex(payload)
    const bytes = decodeHexAudio(hex)
    writeCacheAtomic(cachePath, bytes, this.randomId)
    return { mimeType: 'audio/mpeg', bytes, cached: false }
  }

  private cachePath(voice: string, text: string): string {
    const key = audioCacheKey({
      provider: `minimax-${this.options.region}`,
      model: this.options.model,
      voice,
      text,
      speed: 1,
    })
    return path.join(this.options.cacheDir, `${key}.mp3`)
  }

  private async request(text: string, voice: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await this.fetchImpl(this.options.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          text,
          stream: false,
          language_boost: 'Japanese',
          output_format: 'hex',
          voice_setting: {
            voice_id: voice,
            speed: 1,
            vol: 1,
            pitch: 0,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: 'mp3',
            channel: 1,
          },
        }),
        signal: controller.signal,
      })
    } catch (error) {
      if (isAbortError(error)) {
        throw new ProviderError('unknown', 'MiniMax 语音请求超时，请稍后重试。', true)
      }
      throw new ProviderError('network', '无法连接 MiniMax 语音服务，请检查网络后重试。', true)
    } finally {
      clearTimeout(timer)
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text()
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new ProviderError('invalid_response', 'MiniMax 返回的音频无法解析，请重试。', true)
  }
}

function miniMaxStatus(payload: unknown): number | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const base = (payload as { base_resp?: { status_code?: unknown } }).base_resp
  return typeof base?.status_code === 'number' ? base.status_code : undefined
}

function httpStatusError(httpStatus: number): ProviderError {
  if (httpStatus === 401 || httpStatus === 403) {
    return new ProviderError(
      'authentication',
      'MiniMax API Key 无效或未授权，请检查 Key 和区域后重试。',
      false,
    )
  }
  if (httpStatus === 429) {
    return new ProviderError('rate_limit', 'MiniMax 请求过于频繁，请稍后再试。', true)
  }
  return new ProviderError('unknown', 'MiniMax 语音生成失败，请稍后重试。', true)
}

function audioHex(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new ProviderError('invalid_response', 'MiniMax 返回的音频无法解析，请重试。', true)
  }
  const audio = (payload as { data?: { audio?: unknown } }).data?.audio
  if (typeof audio !== 'string' || !audio.trim()) {
    throw new ProviderError('invalid_response', 'MiniMax 返回的音频无法解析，请重试。', true)
  }
  return audio.trim()
}

function decodeHexAudio(hex: string): Buffer {
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
    throw new ProviderError('invalid_response', 'MiniMax 返回的音频无法解析，请重试。', true)
  }
  const bytes = Buffer.from(hex, 'hex')
  if (bytes.byteLength === 0) {
    throw new ProviderError('invalid_response', 'MiniMax 返回的音频无法解析，请重试。', true)
  }
  return bytes
}

function mappedMiniMaxError(statusCode: number): ProviderError {
  if (statusCode === 1004 || statusCode === 2049) {
    return new ProviderError(
      'authentication',
      'MiniMax API Key 无效或未授权，请检查 Key 和区域后重试。',
      false,
    )
  }
  if (statusCode === 1002) {
    return new ProviderError('rate_limit', 'MiniMax 请求过于频繁，请稍后再试。', true)
  }
  if (statusCode === 1008) {
    return new ProviderError('unknown', 'MiniMax 账户余额不足，请充值后再试。', false)
  }
  if (statusCode === 2056) {
    return new ProviderError('rate_limit', 'MiniMax Token Plan 额度已用尽，请稍后再试。', true)
  }
  if (statusCode === 1026 || statusCode === 2013) {
    return new ProviderError(
      'invalid_response',
      'MiniMax 请求参数或文本无效，请检查模型、音色和文本后重试。',
      false,
    )
  }
  return new ProviderError('unknown', 'MiniMax 语音生成失败，请稍后重试。', true)
}

function writeCacheAtomic(filePath: string, bytes: Buffer, randomId: () => string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${randomId()}.tmp`
  try {
    fs.writeFileSync(tempPath, bytes)
    fs.renameSync(tempPath, filePath)
  } catch {
    try {
      fs.unlinkSync(tempPath)
    } catch {
      // Leave any previous valid cache file untouched.
    }
  }
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: string }).name === 'AbortError',
  )
}
