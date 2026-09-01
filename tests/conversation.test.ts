import { describe, expect, it } from 'vitest'
import { ProviderError } from '../src/shared/errors'
import { kamauAnalysis, miniPngImage } from './fixtures/prd-cases'
import { createTestApp } from './helpers/app'

describe('text and image analysis flow', () => {
  it('persists a user message then an analysis card for 俺に構うな', async () => {
    const app = createTestApp({ analysis: kamauAnalysis })
    const conversation = app.conversations.create()
    const result = await app.conversations.send({
      conversationId: conversation.id,
      text: '俺に構うな',
      images: [],
    })
    expect(result.userMessage.content[0]).toMatchObject({ type: 'text', text: '俺に構うな' })
    expect(result.assistantMessage?.analysis?.reading).toBe('おれに かまうな')
    expect(result.assistantMessage?.analysis?.translation).toBe('别管我')
    expect(
      result.assistantMessage?.analysis?.vocabulary.some((item) => item.surface === '構う'),
    ).toBe(true)
    expect(result.assistantMessage?.analysis?.grammar[0]?.pattern).toBe('～な')
    expect(result.assistantMessage?.analysis?.tone?.description).toContain('冷淡')
    app.close()
  })

  it('keeps the user message and allows retry after a provider failure', async () => {
    let fail = true
    const app = createTestApp({
      aiProvider: {
        analyze: async () => {
          if (fail) {
            throw new ProviderError('network', 'offline', true)
          }
          return kamauAnalysis
        },
      },
    })
    const conversation = app.conversations.create()
    const failed = await app.conversations.send({
      conversationId: conversation.id,
      text: '俺に構うな',
      images: [],
    })
    expect(failed.assistantMessage).toBeUndefined()
    expect(failed.userMessage.error?.retryable).toBe(true)
    expect(app.conversations.get(conversation.id).messages).toHaveLength(1)
    fail = false
    const retried = await app.conversations.retry(failed.userMessage.id)
    expect(retried.assistantMessage?.analysis?.original).toBe('俺に構うな')
    app.close()
  })

  it('stores screenshots under generated names and analyzes them', async () => {
    const app = createTestApp({ analysis: kamauAnalysis })
    const conversation = app.conversations.create()
    const result = await app.conversations.send({
      conversationId: conversation.id,
      text: '这句话什么意思？',
      images: [miniPngImage('..\\..\\Windows\\system32\\evil.png')],
    })
    const image = result.userMessage.content.find((part) => part.type === 'image')
    expect(image && image.type === 'image' ? image.attachmentId : '').not.toContain('evil')
    const attachment = app.repos.getAttachment(
      image && image.type === 'image' ? image.attachmentId : '',
    )
    expect(attachment?.storedName.endsWith('.png')).toBe(true)
    expect(attachment?.storedName).not.toContain('Windows')
    expect(result.assistantMessage?.analysis?.original).toBe('俺に構うな')
    app.close()
  })
})
