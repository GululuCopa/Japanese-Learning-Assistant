import path from 'node:path'
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_MESSAGE } from '@shared/constants'
import { detectImageMime } from '@shared/image'
import type { StagedImage } from '@shared/types'

export interface PickedFileReader {
  statSize(filePath: string): Promise<number>
  readFile(filePath: string): Promise<Buffer>
}

export async function stagePickedImageFiles(
  filePaths: string[],
  io: PickedFileReader,
): Promise<StagedImage[]> {
  if (filePaths.length > MAX_IMAGES_PER_MESSAGE) {
    throw new Error(`每条消息最多 ${MAX_IMAGES_PER_MESSAGE} 张图片`)
  }

  const staged: StagedImage[] = []
  for (const [index, filePath] of filePaths.entries()) {
    const size = await io.statSize(filePath)
    if (size <= 0) {
      throw new Error(`第 ${index + 1} 张图片是空文件`)
    }
    if (size > MAX_IMAGE_BYTES) {
      throw new Error(`第 ${index + 1} 张图片超过 10 MiB`)
    }
    const bytes = await io.readFile(filePath)
    const mime = detectImageMime(bytes)
    if (!mime) {
      throw new Error(`第 ${index + 1} 张图片必须是 PNG、JPEG 或 WebP`)
    }
    staged.push({
      name: path.basename(filePath) || `image-${index + 1}`,
      mimeType: mime,
      byteSize: bytes.byteLength,
      dataBase64: bytes.toString('base64'),
    })
  }
  return staged
}
