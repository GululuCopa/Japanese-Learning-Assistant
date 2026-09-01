import fs from 'node:fs'
import path from 'node:path'
import { extensionForMime, validateStagedImages } from '@shared/image'
import type { StagedImage } from '@shared/types'

export interface StoredAttachment {
  id: string
  storedName: string
  mimeType: string
  byteSize: number
  originalName?: string
  absolutePath: string
}

export class AttachmentStore {
  constructor(
    private readonly rootDir: string,
    private readonly randomId: () => string = () => crypto.randomUUID(),
  ) {}

  store(images: StagedImage[]): StoredAttachment[] {
    const validated = validateStagedImages(images)
    fs.mkdirSync(this.rootDir, { recursive: true })
    return validated.map((image) => {
      const id = this.randomId()
      const storedName = `${id}${extensionForMime(image.mimeType)}`
      const absolutePath = path.join(this.rootDir, storedName)
      const resolvedRoot = path.resolve(this.rootDir)
      const resolvedTarget = path.resolve(absolutePath)
      const relative = path.relative(resolvedRoot, resolvedTarget)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Attachment path escaped storage directory')
      }
      fs.writeFileSync(resolvedTarget, Buffer.from(image.dataBase64, 'base64'))
      return {
        id,
        storedName,
        mimeType: image.mimeType,
        byteSize: image.byteSize,
        originalName: image.name,
        absolutePath: resolvedTarget,
      }
    })
  }

  read(storedName: string): Buffer {
    const absolutePath = path.join(this.rootDir, storedName)
    const resolvedRoot = path.resolve(this.rootDir)
    const resolvedTarget = path.resolve(absolutePath)
    const relative = path.relative(resolvedRoot, resolvedTarget)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Attachment path escaped storage directory')
    }
    return fs.readFileSync(resolvedTarget)
  }

  absolutePath(storedName: string): string {
    return path.join(this.rootDir, storedName)
  }
}
