import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { kamauAnalysis, miniPngImage } from './fixtures/prd-cases'
import { createTestApp, tempDir } from './helpers/app'

describe('Obsidian export', () => {
  it('exports 構う.md with YAML and a screenshot embed', async () => {
    const app = createTestApp({ analysis: kamauAnalysis })
    const vault = tempDir('jla-vault-')
    app.settings.save({
      aiBaseUrl: 'https://example.test/v1',
      aiModel: 'gpt-test',
      aiApiKey: 'sk-test',
      voiceGender: 'female',
      obsidianVaultPath: vault,
      responseLanguage: 'zh-CN',
    })
    const conversation = app.conversations.create()
    const sent = await app.conversations.send({
      conversationId: conversation.id,
      text: '这句话什么意思？',
      images: [miniPngImage('game.png')],
    })
    const screenshotId = sent.userMessage.content.find((part) => part.type === 'image')
    const saved = app.notes.save({
      kind: 'word',
      item: kamauAnalysis.vocabulary[1]!,
      originalSentence: '俺に構うな',
      translation: '别管我',
      screenshotAttachmentId:
        screenshotId && screenshotId.type === 'image' ? screenshotId.attachmentId : undefined,
    })
    const exported = app.exportNote(saved.note.id)
    expect(exported.ok).toBe(true)
    expect(exported.relPath).toBe('Japanese/Words/構う.md')
    const markdown = fs.readFileSync(path.join(vault, 'Japanese', 'Words', '構う.md'), 'utf8')
    expect(markdown).toContain('type: japanese-word')
    expect(markdown).toContain('# 構う')
    expect(markdown).toContain('かまう')
    expect(markdown).toMatch(/!\[\[..\/Assets\/.+\.png\]\]/)
    const assets = fs.readdirSync(path.join(vault, 'Japanese', 'Assets'))
    expect(assets.some((name) => name.endsWith('.png'))).toBe(true)
    const again = app.exportNote(saved.note.id)
    expect(again.relPath).toBe(exported.relPath)
    expect(fs.readdirSync(path.join(vault, 'Japanese', 'Words'))).toEqual(['構う.md'])
    app.close()
  })
})
