import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/app'

describe('voice gender settings', () => {
  it('defaults to female and persists male/female', () => {
    const app = createTestApp()
    expect(app.settings.getPublic().voiceGender).toBe('female')
    const male = app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      voiceGender: 'male',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(male.voiceGender).toBe('male')
    expect(app.settings.getPublic().voiceGender).toBe('male')
    app.close()
  })

  it('loads legacy TTS records without crashing or leaking secrets', () => {
    const first = createTestApp()
    first.repos.putSetting(
      'app',
      {
        aiBaseUrl: 'https://example.test/v1',
        aiModel: 'gpt-test',
        ttsBaseUrl: 'https://tts.example/v1',
        ttsModel: 'tts-1',
        ttsVoice: 'alloy',
        ttsApiKey: { kind: 'encrypted', ciphertext: 'c2stc2VjcmV0LXR0cw==' },
        obsidianVaultPath: '',
        responseLanguage: 'zh-CN',
      },
      '2026-09-01T00:00:00.000Z',
    )
    const publicSettings = first.settings.getPublic()
    expect(publicSettings.voiceGender).toBe('female')
    expect(JSON.stringify(publicSettings)).not.toContain('tts.example')
    expect(JSON.stringify(publicSettings)).not.toContain('alloy')
    expect(JSON.stringify(publicSettings)).not.toContain('sk-secret')
    expect(JSON.stringify(publicSettings)).not.toMatch(/ttsBaseUrl|hasTtsApiKey|ttsApiKey/)
    const saved = first.settings.save({
      aiBaseUrl: publicSettings.aiBaseUrl,
      aiModel: publicSettings.aiModel,
      voiceGender: 'female',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(saved.voiceGender).toBe('female')
    first.close()
  })
})
