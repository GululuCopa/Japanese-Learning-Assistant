import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { kamauAnalysis, miniPngImage } from './fixtures/prd-cases'
import { createTestApp, tempDir, testSettings } from './helpers/app'

function sentenceInput() {
  return {
    kind: 'sentence' as const,
    original: '今日はいい天気ですね。',
    reading: 'きょうはいいてんきですね。',
    translation: '今天天气真好。',
  }
}

describe('Obsidian delete sync', () => {
  it('removes the exported sentence Markdown when the collection record is deleted', () => {
    const app = createTestApp()
    const vault = tempDir('jla-delete-export-vault-')
    app.settings.save(testSettings({ obsidianVaultPath: vault }))
    const saved = app.notes.save(sentenceInput())
    const exported = app.exportNote(saved.note.id)
    expect(exported.ok).toBe(true)
    const file = path.join(vault, ...exported.relPath!.split('/'))
    expect(fs.existsSync(file)).toBe(true)

    const result = app.deleteNote(saved.note.id)
    expect(result.ok).toBe(true)
    expect(result.obsidianFileDeleted).toBe(true)
    expect(fs.existsSync(file)).toBe(false)
    expect(app.notes.list('sentence')).toHaveLength(0)
    app.close()
  })

  it('removes exported word and grammar Markdown using kind-specific paths', () => {
    const app = createTestApp()
    const vault = tempDir('jla-delete-kinds-')
    app.settings.save(testSettings({ obsidianVaultPath: vault }))
    const word = app.notes.save({
      kind: 'word',
      item: kamauAnalysis.vocabulary[1]!,
      originalSentence: '俺に構うな',
      translation: '别管我',
    })
    const grammar = app.notes.save({
      kind: 'grammar',
      item: kamauAnalysis.grammar[0]!,
      originalSentence: '俺に構うな',
      translation: '别管我',
    })
    const wordExport = app.exportNote(word.note.id)
    const grammarExport = app.exportNote(grammar.note.id)
    const wordFile = path.join(vault, ...wordExport.relPath!.split('/'))
    const grammarFile = path.join(vault, ...grammarExport.relPath!.split('/'))
    expect(wordExport.relPath).toBe('Japanese/Words/構う.md')
    expect(grammarExport.relPath).toBe('Japanese/Grammar/～な.md')

    app.deleteNote(word.note.id)
    app.deleteNote(grammar.note.id)
    expect(fs.existsSync(wordFile)).toBe(false)
    expect(fs.existsSync(grammarFile)).toBe(false)
    expect(app.notes.list('word')).toHaveLength(0)
    expect(app.notes.list('grammar')).toHaveLength(0)
    app.close()
  })

  it('deletes a non-exported note without requiring a Vault', () => {
    const app = createTestApp()
    const saved = app.notes.save(sentenceInput())
    const result = app.deleteNote(saved.note.id)
    expect(result.ok).toBe(true)
    expect(result.obsidianFileDeleted).toBe(false)
    expect(app.notes.list('sentence')).toHaveLength(0)
    app.close()
  })

  it('treats a missing exported file as synchronized and deletes the database row', () => {
    const app = createTestApp()
    const vault = tempDir('jla-delete-missing-')
    app.settings.save(testSettings({ obsidianVaultPath: vault }))
    const saved = app.notes.save(sentenceInput())
    const exported = app.exportNote(saved.note.id)
    const file = path.join(vault, ...exported.relPath!.split('/'))
    fs.rmSync(file)
    const result = app.deleteNote(saved.note.id)
    expect(result.ok).toBe(true)
    expect(result.obsidianFileDeleted).toBe(false)
    expect(app.notes.list('sentence')).toHaveLength(0)
    app.close()
  })

  it('keeps the database row when Vault or path validation fails', () => {
    const app = createTestApp()
    const saved = app.notes.save(sentenceInput())
    app.repos.updateNoteExportPath(
      saved.note.id,
      'Japanese/Sentences/今日はいい天気ですね。.md',
      '2026-09-03T00:00:00.000Z',
    )
    expect(() => app.deleteNote(saved.note.id)).toThrow(/Obsidian|仓库/)
    expect(app.notes.get(saved.note.id).id).toBe(saved.note.id)

    const vault = tempDir('jla-delete-invalid-')
    app.settings.save(testSettings({ obsidianVaultPath: vault }))
    app.repos.updateNoteExportPath(
      saved.note.id,
      'Japanese/Words/今日はいい天気ですね。.md',
      '2026-09-03T00:00:00.000Z',
    )
    expect(() => app.deleteNote(saved.note.id)).toThrow(/导出路径/)
    expect(app.notes.get(saved.note.id).id).toBe(saved.note.id)

    app.repos.updateNoteExportPath(saved.note.id, '../secret.md', '2026-09-03T00:00:00.000Z')
    expect(() => app.deleteNote(saved.note.id)).toThrow(/导出路径/)
    expect(app.notes.get(saved.note.id).id).toBe(saved.note.id)
    app.close()
  })

  it('does not delete a directory target or escape through a symlinked parent', () => {
    const app = createTestApp()
    const vault = tempDir('jla-delete-escape-')
    app.settings.save(testSettings({ obsidianVaultPath: vault }))
    const saved = app.notes.save(sentenceInput())
    const exported = app.exportNote(saved.note.id)
    const file = path.join(vault, ...exported.relPath!.split('/'))
    fs.rmSync(file)
    fs.mkdirSync(file)
    expect(() => app.deleteNote(saved.note.id)).toThrow()
    expect(app.notes.get(saved.note.id).id).toBe(saved.note.id)
    expect(fs.statSync(file).isDirectory()).toBe(true)
    fs.rmSync(file, { recursive: true })

    const outside = tempDir('jla-delete-outside-')
    const secret = path.join(outside, 'escape.md')
    fs.writeFileSync(secret, 'secret')
    const sentences = path.join(vault, 'Japanese', 'Sentences')
    fs.rmSync(sentences, { recursive: true })
    fs.symlinkSync(outside, sentences)
    expect(() => app.deleteNote(saved.note.id)).toThrow()
    expect(app.notes.get(saved.note.id).id).toBe(saved.note.id)
    expect(fs.existsSync(secret)).toBe(true)
    app.close()
  })

  it('keeps the database row when the Vault file cannot be deleted', () => {
    const app = createTestApp()
    const vault = tempDir('jla-delete-perm-')
    app.settings.save(testSettings({ obsidianVaultPath: vault }))
    const saved = app.notes.save(sentenceInput())
    const exported = app.exportNote(saved.note.id)
    const file = path.join(vault, ...exported.relPath!.split('/'))
    const dir = path.dirname(file)
    const dirMode = fs.statSync(dir).mode
    fs.chmodSync(dir, 0o555)
    try {
      expect(() => app.deleteNote(saved.note.id)).toThrow(/权限/)
      expect(app.notes.get(saved.note.id).id).toBe(saved.note.id)
      expect(fs.existsSync(file)).toBe(true)
    } finally {
      fs.chmodSync(dir, dirMode)
    }
    app.close()
  })

  it('does not delete screenshot assets when removing an exported word note', async () => {
    const app = createTestApp({ analysis: kamauAnalysis })
    const vault = tempDir('jla-delete-asset-')
    app.settings.save(testSettings({ obsidianVaultPath: vault }))
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
    const assetsDir = path.join(vault, 'Japanese', 'Assets')
    const before = fs.readdirSync(assetsDir)
    expect(before.some((name) => name.endsWith('.png'))).toBe(true)
    app.deleteNote(saved.note.id)
    expect(fs.existsSync(path.join(vault, 'Japanese', 'Words', '構う.md'))).toBe(false)
    expect(fs.readdirSync(assetsDir)).toEqual(before)
    app.close()
  })
})
