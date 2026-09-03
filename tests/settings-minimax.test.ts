import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MINIMAX_FEMALE_VOICE,
  DEFAULT_MINIMAX_MALE_VOICE,
  DEFAULT_MINIMAX_MODEL,
  MINIMAX_ENDPOINTS,
} from '../src/shared/constants'
import { createTestApp } from './helpers/app'

describe('MiniMax settings persistence', () => {
  it('defaults legacy records to system TTS without leaking secrets', () => {
    const app = createTestApp()
    const publicSettings = app.settings.getPublic()
    expect(publicSettings.ttsProvider).toBe('system')
    expect(publicSettings.minimaxRegion).toBe('china')
    expect(publicSettings.minimaxModel).toBe(DEFAULT_MINIMAX_MODEL)
    expect(publicSettings.minimaxFemaleVoice).toBe(DEFAULT_MINIMAX_FEMALE_VOICE)
    expect(publicSettings.minimaxMaleVoice).toBe(DEFAULT_MINIMAX_MALE_VOICE)
    expect(publicSettings.hasMinimaxApiKey).toBe(false)
    expect(JSON.stringify(publicSettings)).not.toMatch(/minimaxApiKey":/)
    app.close()
  })

  it('encrypts MiniMax keys and never returns them publicly or in the database', () => {
    const app = createTestApp()
    const saved = app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      voiceGender: 'female',
      ttsProvider: 'minimax',
      minimaxRegion: 'global',
      minimaxModel: 'speech-2.8-turbo',
      minimaxFemaleVoice: 'Japanese_KindLady',
      minimaxMaleVoice: 'Japanese_LoyalKnight',
      minimaxApiKey: 'sk-minimax-secret-key',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(saved.hasMinimaxApiKey).toBe(true)
    expect(saved.ttsProvider).toBe('minimax')
    expect(saved.minimaxRegion).toBe('global')
    expect(JSON.stringify(saved)).not.toContain('sk-minimax-secret-key')
    expect(JSON.stringify(saved)).not.toMatch(/minimaxApiKey/)
    expect(fs.readFileSync(app.paths.databaseFile).includes('sk-minimax-secret-key')).toBe(false)
    expect(app.settings.resolveSecrets().minimaxApiKey).toBe('sk-minimax-secret-key')
    const config = app.settings.requireMinimaxTtsConfig()
    expect(config.endpoint).toBe(MINIMAX_ENDPOINTS.global)
    expect(config.model).toBe('speech-2.8-turbo')
    expect(config.femaleVoice).toBe('Japanese_KindLady')
    expect(config.maleVoice).toBe('Japanese_LoyalKnight')
    expect(config.apiKey).toBe('sk-minimax-secret-key')
    app.close()
  })

  it('preserves a blank MiniMax key and clears on explicit request', () => {
    const app = createTestApp()
    app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      voiceGender: 'female',
      ttsProvider: 'minimax',
      minimaxRegion: 'china',
      minimaxModel: DEFAULT_MINIMAX_MODEL,
      minimaxFemaleVoice: DEFAULT_MINIMAX_FEMALE_VOICE,
      minimaxMaleVoice: DEFAULT_MINIMAX_MALE_VOICE,
      minimaxApiKey: 'sk-keep-me',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    const preserved = app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      voiceGender: 'female',
      ttsProvider: 'minimax',
      minimaxRegion: 'china',
      minimaxModel: DEFAULT_MINIMAX_MODEL,
      minimaxFemaleVoice: DEFAULT_MINIMAX_FEMALE_VOICE,
      minimaxMaleVoice: DEFAULT_MINIMAX_MALE_VOICE,
      minimaxApiKey: '',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(preserved.hasMinimaxApiKey).toBe(true)
    expect(app.settings.resolveSecrets().minimaxApiKey).toBe('sk-keep-me')

    const cleared = app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      voiceGender: 'female',
      ttsProvider: 'minimax',
      minimaxRegion: 'china',
      minimaxModel: DEFAULT_MINIMAX_MODEL,
      minimaxFemaleVoice: DEFAULT_MINIMAX_FEMALE_VOICE,
      minimaxMaleVoice: DEFAULT_MINIMAX_MALE_VOICE,
      clearMinimaxApiKey: true,
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(cleared.hasMinimaxApiKey).toBe(false)
    expect(app.settings.resolveSecrets().minimaxApiKey).toBeUndefined()
    expect(() => app.settings.requireMinimaxTtsConfig()).toThrowError(/MiniMax/)
    app.close()
  })

  it('keeps MiniMax keys session-only when OS encryption is unavailable', () => {
    const app = createTestApp({ encryption: false })
    const saved = app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      voiceGender: 'female',
      ttsProvider: 'minimax',
      minimaxRegion: 'china',
      minimaxModel: DEFAULT_MINIMAX_MODEL,
      minimaxFemaleVoice: DEFAULT_MINIMAX_FEMALE_VOICE,
      minimaxMaleVoice: DEFAULT_MINIMAX_MALE_VOICE,
      minimaxApiKey: 'sk-session-minimax',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(saved.hasMinimaxApiKey).toBe(true)
    expect(saved.encryptionWarning).toMatch(/本次会话/)
    expect(fs.readFileSync(app.paths.databaseFile, 'utf8')).not.toContain('sk-session-minimax')
    expect(app.settings.resolveSecrets().minimaxApiKey).toBe('sk-session-minimax')
    app.close()
  })

  it('replaces unknown MiniMax model/voice values with defaults and keeps valid ones', () => {
    const app = createTestApp()
    const saved = app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      voiceGender: 'female',
      ttsProvider: 'minimax',
      minimaxRegion: 'mars' as never,
      minimaxModel: 'not-a-model',
      minimaxFemaleVoice: 'English_expressive_narrator',
      minimaxMaleVoice: 'Japanese_GentleButler',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(saved.minimaxRegion).toBe('china')
    expect(saved.minimaxModel).toBe(DEFAULT_MINIMAX_MODEL)
    expect(saved.minimaxFemaleVoice).toBe(DEFAULT_MINIMAX_FEMALE_VOICE)
    expect(saved.minimaxMaleVoice).toBe('Japanese_GentleButler')
    app.close()
  })
})
