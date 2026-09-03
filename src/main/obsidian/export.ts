import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { OBSIDIAN_DIRS } from '@shared/constants'
import type { ExportResult, NoteKind, NoteRecord } from '@shared/types'
import type { AppRepositories } from '../database/repositories'
import {
  asPathApi,
  isPathInside,
  resolveUnderVault,
  sanitizeWindowsFileName,
  uniqueRelPath,
  type PathApi,
} from './paths'
import { assetEmbedPath, noteMarkdown } from './templates'

export class ObsidianExporter {
  constructor(
    private readonly repos: AppRepositories,
    private readonly readAttachment: (storedName: string) => Buffer,
    private readonly now: () => Date,
    private readonly pathApi: PathApi = asPathApi(path),
  ) {}

  exportNote(noteId: string, vaultPath: string): ExportResult {
    const note = this.repos.getNoteById(noteId)
    if (!note) {
      return { ok: false, message: '笔记不存在' }
    }
    try {
      const vault = this.requireVault(vaultPath)
      this.ensureVaultLayout(vault)
      const folder = folderFor(note.kind)
      const fileName = `${sanitizeWindowsFileName(note.title)}.md`
      let relParts = [OBSIDIAN_DIRS.root, folder, fileName]
      if (note.exportRelPath) {
        relParts = note.exportRelPath.split(/[\\/]+/)
      } else {
        const existing = collectExisting(vault, [OBSIDIAN_DIRS.root, folder], this.pathApi)
        const uniqueName = uniqueRelPath(fileName, existing)
        relParts = [OBSIDIAN_DIRS.root, folder, uniqueName]
      }

      let assetRelPosix: string | undefined
      if (note.screenshotAttachmentId) {
        assetRelPosix = this.copyScreenshot(vault, note)
      }

      const abs = resolveUnderVault(vault, relParts, this.pathApi)
      this.atomicWrite(abs, noteMarkdown(note, assetRelPosix))
      const relPath = relParts.join('/')
      this.repos.updateNoteExportPath(note.id, relPath, this.now().toISOString())
      return {
        ok: true,
        relPath,
        absolutePath: abs,
        message: `已导出到 ${relPath}`,
      }
    } catch (error) {
      return { ok: false, message: exportErrorMessage(error) }
    }
  }

  deleteExportedMarkdown(note: NoteRecord, vaultPath: string): boolean {
    if (!note.exportRelPath) return false
    const vault = this.requireVault(vaultPath)
    const relParts = parseRecordedExportPath(note)
    const abs = resolveUnderVault(vault, relParts, this.pathApi)
    assertParentInsideRealVault(vault, abs, this.pathApi)
    try {
      const stat = fs.lstatSync(abs)
      if (stat.isDirectory()) {
        throw new Error('Obsidian 导出路径指向文件夹，已阻止删除。')
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      if (error instanceof Error && error.message.includes('文件夹')) throw error
      throw wrapDeleteFs(error)
    }
    try {
      fs.unlinkSync(abs)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw wrapDeleteFs(error)
    }
  }

  requireVault(vaultPath: string): string {
    const trimmed = vaultPath.trim()
    if (!trimmed) {
      throw Object.assign(new Error('请先在设置中选择 Obsidian 仓库路径'), { code: 'ENOENT' })
    }
    let stat: fs.Stats
    try {
      stat = fs.statSync(trimmed)
    } catch (error) {
      throw wrapFs(error, trimmed)
    }
    if (!stat.isDirectory()) {
      throw new Error('Obsidian 仓库路径必须是文件夹')
    }
    try {
      fs.accessSync(trimmed, fs.constants.W_OK)
    } catch (error) {
      throw wrapFs(error, trimmed)
    }
    return path.resolve(trimmed)
  }

  private ensureVaultLayout(vault: string): void {
    const dirs = [
      [OBSIDIAN_DIRS.root],
      [OBSIDIAN_DIRS.root, OBSIDIAN_DIRS.words],
      [OBSIDIAN_DIRS.root, OBSIDIAN_DIRS.sentences],
      [OBSIDIAN_DIRS.root, OBSIDIAN_DIRS.grammar],
      [OBSIDIAN_DIRS.root, OBSIDIAN_DIRS.assets],
    ]
    for (const parts of dirs) {
      const target = resolveUnderVault(vault, parts, this.pathApi)
      fs.mkdirSync(target, { recursive: true })
    }
  }

  private copyScreenshot(vault: string, note: NoteRecord): string {
    const attachment = this.repos.getAttachment(note.screenshotAttachmentId!)
    if (!attachment) {
      throw new Error('找不到关联截图')
    }
    const ext = path.extname(attachment.storedName) || '.png'
    const stamp = this.now().toISOString().slice(0, 10)
    const fileName = sanitizeWindowsFileName(`${stamp}-${note.id.slice(0, 8)}${ext}`)
    const abs = resolveUnderVault(
      vault,
      [OBSIDIAN_DIRS.root, OBSIDIAN_DIRS.assets, fileName],
      this.pathApi,
    )
    fs.writeFileSync(abs, this.readAttachment(attachment.storedName))
    return assetEmbedPath(fileName)
  }

  private atomicWrite(target: string, content: string): void {
    const dir = this.pathApi.dirname(target)
    fs.mkdirSync(dir, { recursive: true })
    const temp = this.pathApi.join(dir, `.${this.pathApi.basename(target)}.${process.pid}.tmp`)
    try {
      fs.writeFileSync(temp, content, { encoding: 'utf8' })
      try {
        fs.renameSync(temp, target)
      } catch {
        if (fs.existsSync(target)) {
          fs.rmSync(target)
        }
        fs.renameSync(temp, target)
      }
    } finally {
      if (fs.existsSync(temp)) {
        fs.rmSync(temp, { force: true })
      }
    }
  }
}

function parseRecordedExportPath(note: NoteRecord): string[] {
  const parts = note.exportRelPath?.split(/[\\/]+/).filter((part) => part.length > 0) ?? []
  const expectedFolder = folderFor(note.kind)
  const fileName = parts[2]
  if (
    parts.length !== 3 ||
    parts[0] !== OBSIDIAN_DIRS.root ||
    parts[1] !== expectedFolder ||
    !fileName ||
    !fileName.endsWith('.md') ||
    fileName === '.md' ||
    parts.some((part) => part === '.' || part === '..' || part.includes('\0'))
  ) {
    throw new Error('Obsidian 导出路径无效，已阻止删除以免误删文件。')
  }
  return parts
}

function assertParentInsideRealVault(vault: string, abs: string, pathApi: PathApi): void {
  const parent = pathApi.dirname(abs)
  if (!fs.existsSync(parent)) return
  const vaultReal = fs.realpathSync(vault)
  const parentReal = fs.realpathSync(parent)
  if (!isPathInside(vaultReal, parentReal, pathApi) && pathApi.resolve(vaultReal) !== parentReal) {
    throw new Error('导出路径必须位于所选 Obsidian 仓库内')
  }
}

function wrapDeleteFs(error: unknown): Error {
  const code = (error as NodeJS.ErrnoException).code
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
    return new Error('没有删除 Obsidian 文件的权限。请检查当前 Vault 文件夹权限后重试。')
  }
  return error instanceof Error ? error : new Error('无法删除 Obsidian 文件。')
}

function folderFor(kind: NoteKind): string {
  if (kind === 'word') return OBSIDIAN_DIRS.words
  if (kind === 'sentence') return OBSIDIAN_DIRS.sentences
  return OBSIDIAN_DIRS.grammar
}

function collectExisting(vault: string, parts: string[], pathApi: PathApi): Set<string> {
  const dir = resolveUnderVault(vault, parts, pathApi)
  if (!fs.existsSync(dir)) return new Set()
  return new Set(fs.readdirSync(dir))
}

function wrapFs(error: unknown, vaultPath: string): Error {
  const code = (error as NodeJS.ErrnoException).code
  if (code === 'ENOENT') {
    return new Error(`无法访问仓库路径（可能磁盘不存在）：${vaultPath}`)
  }
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
    return new Error(`没有写入仓库的权限：${vaultPath}`)
  }
  return error instanceof Error ? error : new Error('导出失败')
}

export function exportErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '导出失败'
}

export function defaultVaultExample(): string {
  return os.platform() === 'win32'
    ? 'D:\\Obsidian\\MyVault'
    : path.join(os.homedir(), 'Obsidian', 'MyVault')
}
