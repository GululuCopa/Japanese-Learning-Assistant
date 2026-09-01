import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES } from '../src/shared/constants'
import { detectImageMime, validateStagedImages } from '../src/shared/image'
import { miniPngImage } from './fixtures/prd-cases'

describe('image validation', () => {
  it('detects PNG JPEG and WebP magic bytes', () => {
    expect(detectImageMime(Buffer.from(miniPngImage().dataBase64, 'base64'))).toBe('image/png')
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg')
    expect(
      detectImageMime(Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
    ).toBe('image/webp')
    expect(detectImageMime(Buffer.from('not-an-image'))).toBeNull()
  })

  it('rejects oversized, too many, and non-image payloads', () => {
    const png = miniPngImage('..\\..\\Windows\\evil.png')
    const validated = validateStagedImages([png])
    expect(validated[0]?.mimeType).toBe('image/png')
    expect(() =>
      validateStagedImages([
        miniPngImage('1.png'),
        miniPngImage('2.png'),
        miniPngImage('3.png'),
        miniPngImage('4.png'),
        miniPngImage('5.png'),
      ]),
    ).toThrow(/最多 4/)
    expect(() =>
      validateStagedImages([
        {
          name: 'big.png',
          mimeType: 'image/png',
          byteSize: MAX_IMAGE_BYTES + 1,
          dataBase64: Buffer.alloc(MAX_IMAGE_BYTES + 1).toString('base64'),
        },
      ]),
    ).toThrow(/10 MiB/)
    expect(() =>
      validateStagedImages([
        {
          name: 'note.txt',
          mimeType: 'image/png',
          byteSize: 4,
          dataBase64: Buffer.from('text').toString('base64'),
        },
      ]),
    ).toThrow(/PNG、JPEG 或 WebP/)
  })
})
