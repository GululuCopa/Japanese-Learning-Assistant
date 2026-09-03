import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_MINIMAX_FEMALE_VOICE,
  DEFAULT_MINIMAX_MALE_VOICE,
  DEFAULT_MINIMAX_MODEL,
  MINIMAX_ENDPOINTS,
} from '../src/shared/constants'
import { MiniMaxTTSProvider } from '../src/main/tts/minimax'
import { SystemTTSProvider } from '../src/main/tts/system'
import { createTestApp, tempDir } from './helpers/app'

const AUDIO_BYTES = Buffer.from('ID3fake-mp3')
const AUDIO_HEX = AUDIO_BYTES.toString('hex')
const SECRET = 'sk-minimax-secret-key'

function successBody(hex = AUDIO_HEX) {
  return {
    data: { audio: hex, status: 2 },
    extra_info: { audio_format: 'mp3' },
    base_resp: { status_code: 0, status_msg: 'success' },
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function createProvider(fetchImpl: typeof fetch, cacheDir?: string) {
  return new MiniMaxTTSProvider({
    endpoint: MINIMAX_ENDPOINTS.china,
    region: 'china',
    model: DEFAULT_MINIMAX_MODEL,
    femaleVoice: DEFAULT_MINIMAX_FEMALE_VOICE,
    maleVoice: DEFAULT_MINIMAX_MALE_VOICE,
    apiKey: SECRET,
    cacheDir: cacheDir ?? path.join(tempDir('jla-minimax-'), 'cache'),
    fetchImpl,
  })
}

describe('MiniMaxTTSProvider', () => {
  it('posts the official T2A v2 contract with Japanese boost and normal speed', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(MINIMAX_ENDPOINTS.china)
      expect(init?.method).toBe('POST')
      const headers = new Headers(init?.headers)
      expect(headers.get('authorization')).toBe(`Bearer ${SECRET}`)
      expect(headers.get('content-type')).toBe('application/json')
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body).toMatchObject({
        model: DEFAULT_MINIMAX_MODEL,
        text: 'こんにちは',
        stream: false,
        language_boost: 'Japanese',
        output_format: 'hex',
        voice_setting: {
          voice_id: DEFAULT_MINIMAX_FEMALE_VOICE,
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
      })
      expect(JSON.stringify(body)).not.toContain(SECRET)
      return jsonResponse(successBody())
    }) as unknown as typeof fetch

    const result = await createProvider(fetchImpl).speak('こんにちは', { voiceGender: 'female' })
    expect(result.mimeType).toBe('audio/mpeg')
    expect(result.cached).toBe(false)
    expect(Buffer.from(result.bytes).equals(AUDIO_BYTES)).toBe(true)
  })

  it('uses the global endpoint and male Japanese voice when configured', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(MINIMAX_ENDPOINTS.global)
      const body = JSON.parse(String(init?.body)) as { voice_setting: { voice_id: string } }
      expect(body.voice_setting.voice_id).toBe(DEFAULT_MINIMAX_MALE_VOICE)
      return jsonResponse(successBody())
    }) as unknown as typeof fetch

    const provider = new MiniMaxTTSProvider({
      endpoint: MINIMAX_ENDPOINTS.global,
      region: 'global',
      model: 'speech-2.8-turbo',
      femaleVoice: DEFAULT_MINIMAX_FEMALE_VOICE,
      maleVoice: DEFAULT_MINIMAX_MALE_VOICE,
      apiKey: SECRET,
      cacheDir: path.join(tempDir('jla-minimax-'), 'cache'),
      fetchImpl,
    })
    await provider.speak('テスト', { voiceGender: 'male', speed: 0.75 })
    const body = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1]?.body)) as {
      model: string
      voice_setting: { speed: number }
    }
    expect(body.model).toBe('speech-2.8-turbo')
    expect(body.voice_setting.speed).toBe(1)
  })

  it('caches by region, model, voice and text, not playback speed', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(successBody())) as unknown as typeof fetch
    const cacheDir = path.join(tempDir('jla-minimax-cache-'), 'cache')
    const provider = createProvider(fetchImpl, cacheDir)
    const first = await provider.speak('こんにちは', { voiceGender: 'female', speed: 0.75 })
    const second = await provider.speak('こんにちは', { voiceGender: 'female', speed: 1 })
    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await provider.speak('こんにちは', { voiceGender: 'male', speed: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rejects empty text without calling the network', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    await expect(createProvider(fetchImpl).speak('  ')).rejects.toMatchObject({
      name: 'ProviderError',
      message: '没有可朗读的文本',
      retryable: false,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects malformed hex without exposing the payload', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(successBody('zzz'))) as unknown as typeof fetch
    await expect(createProvider(fetchImpl).speak('こんにちは')).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toMatchObject({ name: 'ProviderError', code: 'invalid_response' })
        const message = (error as Error).message
        expect(message).toBe('MiniMax 返回的音频无法解析，请重试。')
        expect(message).not.toContain('zzz')
        expect(message).not.toContain(SECRET)
        return true
      },
    )
  })

  it('maps MiniMax and HTTP failures to actionable errors without secrets', async () => {
    const cases: Array<{ body: unknown; status: number; code: string; message: string }> = [
      {
        body: { base_resp: { status_code: 2049, status_msg: 'invalid api key' } },
        status: 200,
        code: 'authentication',
        message: 'MiniMax API Key 无效或未授权，请检查 Key 和区域后重试。',
      },
      {
        body: { base_resp: { status_code: 1004, status_msg: 'not authorized' } },
        status: 401,
        code: 'authentication',
        message: 'MiniMax API Key 无效或未授权，请检查 Key 和区域后重试。',
      },
      {
        body: { base_resp: { status_code: 1002, status_msg: 'rate limit' } },
        status: 200,
        code: 'rate_limit',
        message: 'MiniMax 请求过于频繁，请稍后再试。',
      },
      {
        body: { base_resp: { status_code: 1008, status_msg: 'insufficient balance' } },
        status: 200,
        code: 'unknown',
        message: 'MiniMax 账户余额不足，请充值后再试。',
      },
      {
        body: { base_resp: { status_code: 2056, status_msg: 'usage limit exceeded' } },
        status: 200,
        code: 'rate_limit',
        message: 'MiniMax Token Plan 额度已用尽，请稍后再试。',
      },
      {
        body: { base_resp: { status_code: 2013, status_msg: 'invalid params' } },
        status: 200,
        code: 'invalid_response',
        message: 'MiniMax 请求参数或文本无效，请检查模型、音色和文本后重试。',
      },
      {
        body: { base_resp: { status_code: 1026, status_msg: 'input sensitive' } },
        status: 200,
        code: 'invalid_response',
        message: 'MiniMax 请求参数或文本无效，请检查模型、音色和文本后重试。',
      },
    ]

    for (const item of cases) {
      const fetchImpl = vi.fn(async () =>
        jsonResponse(item.body, item.status),
      ) as unknown as typeof fetch
      await expect(createProvider(fetchImpl).speak('こんにちは')).rejects.toSatisfy(
        (error: unknown) => {
          expect(error).toMatchObject({
            name: 'ProviderError',
            code: item.code,
            message: item.message,
          })
          expect((error as Error).message).not.toContain(SECRET)
          return true
        },
      )
    }

    const network = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(createProvider(network).speak('こんにちは')).rejects.toMatchObject({
      code: 'network',
      message: '无法连接 MiniMax 语音服务，请检查网络后重试。',
    })
  })

  it('rejects HTTP 500 even when JSON claims status_code 0 and includes audio', async () => {
    const cacheDir = path.join(tempDir('jla-minimax-http500-'), 'cache')
    const fetchImpl = vi.fn(async () => jsonResponse(successBody(), 500)) as unknown as typeof fetch
    const provider = createProvider(fetchImpl, cacheDir)
    await expect(provider.speak('こんにちは')).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'unknown',
      retryable: true,
      message: 'MiniMax 语音生成失败，请稍后重试。',
    })
    expect(fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : []).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('times out a hung request', async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })
    }) as unknown as typeof fetch
    const provider = new MiniMaxTTSProvider({
      endpoint: MINIMAX_ENDPOINTS.china,
      region: 'china',
      model: DEFAULT_MINIMAX_MODEL,
      femaleVoice: DEFAULT_MINIMAX_FEMALE_VOICE,
      maleVoice: DEFAULT_MINIMAX_MALE_VOICE,
      apiKey: SECRET,
      cacheDir: path.join(tempDir('jla-minimax-'), 'cache'),
      fetchImpl,
      timeoutMs: 30,
    })
    await expect(provider.speak('こんにちは')).rejects.toMatchObject({
      message: 'MiniMax 语音请求超时，请稍后重试。',
    })
  })
})

describe('AppServices MiniMax routing', () => {
  it('keeps system TTS as the default and does not fall back from MiniMax', async () => {
    const app = createTestApp()
    expect(await app.createTTSProvider()).toBeInstanceOf(SystemTTSProvider)
    expect(app.settings.getPublic().ttsProvider).toBe('system')
    app.close()
  })

  it('routes to MiniMax with the current speak override, not only persisted gender', async () => {
    const seen: Array<{ voice?: string; gender?: string }> = []
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        voice_setting: { voice_id: string }
      }
      seen.push({ voice: body.voice_setting.voice_id })
      return jsonResponse(successBody())
    }) as unknown as typeof fetch

    const app = createTestApp({ fetchImpl })
    app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      voiceGender: 'female',
      ttsProvider: 'minimax',
      minimaxRegion: 'china',
      minimaxModel: DEFAULT_MINIMAX_MODEL,
      minimaxFemaleVoice: DEFAULT_MINIMAX_FEMALE_VOICE,
      minimaxMaleVoice: DEFAULT_MINIMAX_MALE_VOICE,
      minimaxApiKey: SECRET,
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(JSON.stringify(app.settings.getPublic())).not.toContain(SECRET)
    expect(app.settings.getPublic().hasMinimaxApiKey).toBe(true)

    const preview = await app.speak({ text: 'こんにちは', speed: 1, voiceGender: 'male' })
    expect(preview.mimeType).toBe('audio/mpeg')
    expect(seen[0]?.voice).toBe(DEFAULT_MINIMAX_MALE_VOICE)
    expect(app.settings.getPublic().voiceGender).toBe('female')

    await app.speak({ text: 'こんばんは', speed: 1 })
    expect(seen[1]?.voice).toBe(DEFAULT_MINIMAX_FEMALE_VOICE)
    expect(fs.readFileSync(app.paths.databaseFile).includes(SECRET)).toBe(false)
    app.close()
  })
})
