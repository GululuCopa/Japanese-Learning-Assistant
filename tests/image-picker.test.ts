import { describe, expect, it, vi } from 'vitest'
import { MAX_IMAGE_BYTES } from '../src/shared/constants'
import { stagePickedImageFiles } from '../src/main/attachments/pick'
import { miniPngImage } from './fixtures/prd-cases'

const pngBytes = Buffer.from(miniPngImage().dataBase64, 'base64')

describe('native image picker staging', () => {
  it('rejects more than four paths before reading any file', async () => {
    const readFile = vi.fn(async () => pngBytes)
    const statSize = vi.fn(async () => pngBytes.byteLength)
    await expect(
      stagePickedImageFiles(['a.png', 'b.png', 'c.png', 'd.png', 'e.png'], { statSize, readFile }),
    ).rejects.toThrow(/最多 4/)
    expect(statSize).not.toHaveBeenCalled()
    expect(readFile).not.toHaveBeenCalled()
  })

  it('rejects an oversized file after stat and without readFile', async () => {
    const readFile = vi.fn(async () => pngBytes)
    const statSize = vi.fn(async () => MAX_IMAGE_BYTES + 1)
    await expect(stagePickedImageFiles(['big.png'], { statSize, readFile })).rejects.toThrow(
      /10 MiB/,
    )
    expect(statSize).toHaveBeenCalledTimes(1)
    expect(readFile).not.toHaveBeenCalled()
  })

  it('keeps magic-byte validation after a size-checked read', async () => {
    const readFile = vi.fn(async () => Buffer.from('not-an-image'))
    const statSize = vi.fn(async () => 12)
    await expect(stagePickedImageFiles(['note.txt'], { statSize, readFile })).rejects.toThrow(
      /PNG、JPEG 或 WebP/,
    )
    expect(readFile).toHaveBeenCalledTimes(1)
  })

  it('stages a valid PNG', async () => {
    const staged = await stagePickedImageFiles(['shot.png'], {
      statSize: async () => pngBytes.byteLength,
      readFile: async () => pngBytes,
    })
    expect(staged).toHaveLength(1)
    expect(staged[0]?.mimeType).toBe('image/png')
    expect(staged[0]?.name).toBe('shot.png')
  })
})
