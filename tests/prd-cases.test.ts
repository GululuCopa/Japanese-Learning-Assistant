import { describe, expect, it } from 'vitest'
import { kamauAnalysis, miniPngImage, namaikiAnalysis } from './fixtures/prd-cases'
import { createTestApp } from './helpers/app'

describe('PRD V0.1 definition of done', () => {
  it('case 1: 生意気怎么念 returns reading なまいき and TTS audio', async () => {
    const app = createTestApp({
      analysis: namaikiAnalysis,
      ttsProvider: {
        speak: async (text) => ({
          mimeType: 'audio/mpeg',
          bytes: Buffer.from(`audio:${text}`),
          cached: false,
        }),
      },
    })
    app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'm',
      aiApiKey: 'k',
      voiceGender: 'female',
      obsidianVaultPath: '',
      responseLanguage: 'zh-CN',
    })
    const conversation = app.conversations.create()
    const result = await app.conversations.send({
      conversationId: conversation.id,
      text: '生意気怎么念？',
      images: [],
    })
    expect(result.assistantMessage?.analysis?.original).toBe('生意気')
    expect(result.assistantMessage?.analysis?.reading).toBe('なまいき')
    const spoken = await app.speak({ text: '生意気', speed: 1 })
    expect(spoken.dataBase64).toBeTruthy()
    expect(JSON.stringify(spoken)).not.toContain('sk-tts-secret')
    app.close()
  })

  it('case 2: screenshot of 俺に構うな yields a full analysis card', async () => {
    const app = createTestApp({ analysis: kamauAnalysis })
    const conversation = app.conversations.create()
    const result = await app.conversations.send({
      conversationId: conversation.id,
      text: '',
      images: [miniPngImage('game-shot.png')],
    })
    const analysis = result.assistantMessage?.analysis
    expect(analysis?.original).toBe('俺に構うな')
    expect(analysis?.reading).toBe('おれに かまうな')
    expect(analysis?.translation).toBe('别管我')
    expect(analysis?.vocabulary.length).toBeGreaterThan(0)
    expect(analysis?.grammar.length).toBeGreaterThan(0)
    expect(analysis?.tone?.description).toBeTruthy()
    app.close()
  })

  it('case 3-5: save 構う, export, and recognize it again', async () => {
    const app = createTestApp({ analysis: kamauAnalysis })
    const conversation = app.conversations.create()
    await app.conversations.send({
      conversationId: conversation.id,
      text: '俺に構うな',
      images: [],
    })
    const saved = app.notes.save({ kind: 'word', item: kamauAnalysis.vocabulary[1]! })
    expect(saved.note.title).toBe('構う')
    expect(app.notes.list('word').map((note) => note.title)).toContain('構う')

    const again = await app.conversations.send({
      conversationId: conversation.id,
      text: '構う',
      images: [],
    })
    expect(
      again.assistantMessage?.analysis?.vocabulary.find((item) => item.surface === '構う')
        ?.alreadySaved,
    ).toBe(true)
    app.close()
  })
})
