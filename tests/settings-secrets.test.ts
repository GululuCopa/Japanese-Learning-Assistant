import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/app'

describe('settings secret persistence', () => {
  it('stores encrypted keys and never returns them to the renderer', () => {
    const app = createTestApp()
    const saved = app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      aiApiKey: 'sk-secret-ai',
      voiceGender: 'female',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(saved.hasAiApiKey).toBe(true)
    expect(saved.voiceGender).toBe('female')
    expect(JSON.stringify(saved)).not.toContain('sk-secret')
    expect(JSON.stringify(saved)).not.toMatch(/ttsBaseUrl|ttsApiKey|hasTtsApiKey/)
    const dbText = fs.readFileSync(app.paths.databaseFile)
    expect(dbText.includes('sk-secret-ai')).toBe(false)
    expect(app.settings.resolveSecrets().aiApiKey).toBe('sk-secret-ai')
    app.close()
  })

  it('keeps keys session-only when OS encryption is unavailable', () => {
    const app = createTestApp({ encryption: false })
    const saved = app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      aiApiKey: 'sk-session-only',
      voiceGender: 'female',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    expect(saved.encryptionAvailable).toBe(false)
    expect(saved.encryptionWarning).toMatch(/本次会话/)
    expect(saved.hasAiApiKey).toBe(true)
    const dbText = fs.readFileSync(app.paths.databaseFile, 'utf8')
    expect(dbText).not.toContain('sk-session-only')
    expect(app.settings.resolveSecrets().aiApiKey).toBe('sk-session-only')
    app.close()
  })
})
