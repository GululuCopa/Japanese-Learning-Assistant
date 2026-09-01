import { describe, expect, it } from 'vitest'
import { kamauAnalysis } from './fixtures/prd-cases'
import { createTestApp } from './helpers/app'

describe('notes and saved-state recognition', () => {
  it('saves 構う once and recognizes it on later analysis', async () => {
    const app = createTestApp({ analysis: kamauAnalysis })
    const conversation = app.conversations.create()
    const result = await app.conversations.send({
      conversationId: conversation.id,
      text: '俺に構うな',
      images: [],
    })
    const vocab = result.assistantMessage?.analysis?.vocabulary.find(
      (item) => item.surface === '構う',
    )
    const first = app.notes.save({
      kind: 'word',
      item: vocab!,
      originalSentence: '俺に構うな',
      translation: '别管我',
    })
    expect(first.alreadySaved).toBe(false)
    expect(first.note.title).toBe('構う')
    expect(first.note.payload.reading).toBe('かまう')
    expect(first.note.payload.meaning).toEqual(['理会', '管', '在意'])
    const second = app.notes.save({
      kind: 'word',
      item: vocab!,
      originalSentence: '俺に構うな',
      translation: '别管我',
    })
    expect(second.alreadySaved).toBe(true)
    expect(app.notes.list('word')).toHaveLength(1)

    const again = await app.conversations.send({
      conversationId: conversation.id,
      text: '構う',
      images: [],
    })
    const marked = again.assistantMessage?.analysis?.vocabulary.find(
      (item) => item.lemma === '構う',
    )
    expect(marked?.alreadySaved).toBe(true)
    app.close()
  })

  it('searches notes and keeps history after reopen', async () => {
    const first = createTestApp()
    const dir = first.paths.userDataDir
    const conversation = first.conversations.create()
    await first.conversations.send({
      conversationId: conversation.id,
      text: '俺に構うな',
      images: [],
    })
    first.notes.save({
      kind: 'word',
      item: kamauAnalysis.vocabulary[1]!,
    })
    first.close()

    const reopened = createTestApp({ userDataDir: dir })
    expect(reopened.conversations.list()[0]?.id).toBe(conversation.id)
    expect(reopened.notes.list('word', 'かまう')[0]?.title).toBe('構う')
    reopened.close()
  })
})
