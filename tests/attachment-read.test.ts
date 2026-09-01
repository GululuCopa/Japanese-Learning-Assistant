import { describe, expect, it } from 'vitest'
import { miniPngImage } from './fixtures/prd-cases'
import { createTestApp } from './helpers/app'

describe('attachment read-by-id', () => {
  it('returns mime and bytes without a filesystem path', async () => {
    const app = createTestApp()
    const conversation = app.conversations.create()
    const result = await app.conversations.send({
      conversationId: conversation.id,
      text: '这句话什么意思？',
      images: [miniPngImage('game.png')],
    })
    const image = result.userMessage.content.find((part) => part.type === 'image')
    expect(image && image.type === 'image' ? image.attachmentId : '').toBeTruthy()
    const bytes = app.readAttachment(image && image.type === 'image' ? image.attachmentId : '')
    expect(bytes.mimeType).toBe('image/png')
    expect(bytes.dataBase64.length).toBeGreaterThan(0)
    expect(JSON.stringify(bytes)).not.toMatch(/attachments|userData|\.\./)
    app.close()
  })
})
