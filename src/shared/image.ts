import { ALLOWED_IMAGE_MIME, MAX_IMAGE_BYTES, MAX_IMAGES_PER_MESSAGE } from './constants'
import type { StagedImage } from './types'

export type DetectedImageMime = (typeof ALLOWED_IMAGE_MIME)[number]

export interface ImageInspection {
  mimeType: DetectedImageMime
}

export function detectImageMime(bytes: Uint8Array): DetectedImageMime | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

export function decodeBase64(data: string): Uint8Array {
  const nodeBuffer = (
    globalThis as { Buffer?: { from(input: string, encoding: string): Uint8Array } }
  ).Buffer
  if (nodeBuffer) {
    return nodeBuffer.from(data, 'base64')
  }
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function validateStagedImages(images: StagedImage[]): StagedImage[] {
  if (images.length > MAX_IMAGES_PER_MESSAGE) {
    throw new Error(`每条消息最多 ${MAX_IMAGES_PER_MESSAGE} 张图片`)
  }
  return images.map((image, index) => {
    const bytes = decodeBase64(image.dataBase64)
    if (bytes.byteLength === 0) {
      throw new Error(`第 ${index + 1} 张图片是空文件`)
    }
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`第 ${index + 1} 张图片超过 10 MiB`)
    }
    const mime = detectImageMime(bytes)
    if (!mime) {
      throw new Error(`第 ${index + 1} 张图片必须是 PNG、JPEG 或 WebP`)
    }
    if (image.byteSize !== bytes.byteLength) {
      throw new Error(`第 ${index + 1} 张图片大小不一致`)
    }
    return {
      name: image.name || `image-${index + 1}`,
      mimeType: mime,
      byteSize: bytes.byteLength,
      dataBase64: image.dataBase64,
    }
  })
}

export function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return '.png'
    case 'image/jpeg':
      return '.jpg'
    case 'image/webp':
      return '.webp'
    default:
      throw new Error('Unsupported image type')
  }
}
