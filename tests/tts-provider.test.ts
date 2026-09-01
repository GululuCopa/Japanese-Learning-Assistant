import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { KOKORO_VOICES } from '../src/shared/constants'
import { kokoroVoiceForGender } from '../src/shared/tts'
import { audioCacheKey } from '../src/main/tts/cache'
import { KokoroTTSProvider } from '../src/main/tts/kokoro-provider'
import { tempDir } from './helpers/app'

describe('Kokoro local TTS provider', () => {
  it('maps male and female genders to stable Japanese voice IDs', () => {
    expect(kokoroVoiceForGender('female')).toBe('jf_alpha')
    expect(kokoroVoiceForGender('male')).toBe('jm_kumo')
    expect(KOKORO_VOICES.female).toBe('jf_alpha')
    expect(KOKORO_VOICES.male).toBe('jm_kumo')
  })

  it('posts the local /v1/audio/speech contract and caches by voice gender and speed', async () => {
    const cacheDir = path.join(tempDir('jla-tts-'), 'audio')
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(String(url)).toBe('http://127.0.0.1:8880/v1/audio/speech')
      expect(String(url)).not.toContain('sk-')
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body.model).toBe('kokoro')
      expect(body.input).toBe('生意気')
      expect(body.response_format).toBe('mp3')
      expect(body.voice === 'jf_alpha' || body.voice === 'jm_kumo').toBe(true)
      expect(body.speed === 0.75 || body.speed === 1).toBe(true)
      expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/authorization|Bearer/i)
      return new Response(Buffer.from('ID3fake-mp3'), { status: 200 })
    }) as unknown as typeof fetch

    const provider = new KokoroTTSProvider({
      baseUrl: 'http://127.0.0.1:8880/v1',
      voiceGender: 'female',
      cacheDir,
      fetchImpl,
    })
    const first = await provider.speak('生意気', { speed: 0.75, voiceGender: 'female' })
    const second = await provider.speak('生意気', { speed: 0.75, voiceGender: 'female' })
    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1]?.body))).toMatchObject({
      voice: 'jf_alpha',
      speed: 0.75,
    })

    await provider.speak('生意気', { speed: 1, voiceGender: 'female' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    await provider.speak('生意気', { speed: 0.75, voiceGender: 'male' })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(
      audioCacheKey({
        provider: 'kokoro-local',
        model: 'kokoro',
        voice: 'jf_alpha',
        text: '生意気',
        speed: 0.75,
        voiceGender: 'female',
      }),
    ).not.toBe(
      audioCacheKey({
        provider: 'kokoro-local',
        model: 'kokoro',
        voice: 'jm_kumo',
        text: '生意気',
        speed: 0.75,
        voiceGender: 'male',
      }),
    )
  })
})
