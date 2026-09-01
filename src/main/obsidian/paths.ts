import type * as NodePath from 'node:path'

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
// Windows forbids C0 controls in file names.
const WINDOWS_INVALID = new RegExp(
  `[<>:"/\\\\|?*${String.fromCharCode(0)}-${String.fromCharCode(31)}]`,
  'g',
)

export interface PathApi {
  join: (...parts: string[]) => string
  resolve: (...parts: string[]) => string
  relative: (from: string, to: string) => string
  dirname: (p: string) => string
  basename: (p: string, ext?: string) => string
  isAbsolute: (p: string) => boolean
  sep: string
}

export function sanitizeWindowsFileName(name: string): string {
  const withoutExtSplit = name.replace(WINDOWS_INVALID, '_').replace(/[. ]+$/g, '')
  const trimmed = withoutExtSplit.trim() || 'note'
  const stem = trimmed.replace(/\.[^.]+$/, '')
  const ext = trimmed.slice(stem.length)
  if (WINDOWS_RESERVED.test(stem)) {
    return `${stem}_${ext}`
  }
  return `${stem}${ext}`.slice(0, 120)
}

export function isPathInside(root: string, target: string, pathApi: PathApi): boolean {
  const resolvedRoot = pathApi.resolve(root)
  const resolvedTarget = pathApi.resolve(target)
  const relative = pathApi.relative(resolvedRoot, resolvedTarget)
  return relative !== '' && !relative.startsWith('..') && !pathApi.isAbsolute(relative)
}

export function resolveUnderVault(vaultRoot: string, parts: string[], pathApi: PathApi): string {
  const target = pathApi.resolve(pathApi.join(vaultRoot, ...parts))
  if (!isPathInside(vaultRoot, target, pathApi) && pathApi.resolve(vaultRoot) !== target) {
    throw new Error('导出路径必须位于所选 Obsidian 仓库内')
  }
  if (parts.some((part) => part === '..' || part.includes('\0'))) {
    throw new Error('导出路径包含非法片段')
  }
  return target
}

export function uniqueRelPath(desiredBase: string, used: Set<string>): string {
  if (!used.has(desiredBase)) {
    return desiredBase
  }
  const dot = desiredBase.lastIndexOf('.')
  const stem = dot >= 0 ? desiredBase.slice(0, dot) : desiredBase
  const ext = dot >= 0 ? desiredBase.slice(dot) : ''
  let index = 2
  while (used.has(`${stem}-${index}${ext}`)) {
    index += 1
  }
  return `${stem}-${index}${ext}`
}

export function toPosixRel(parts: string[]): string {
  return parts.join('/')
}

export function asPathApi(mod: typeof NodePath): PathApi {
  return {
    join: mod.join,
    resolve: mod.resolve,
    relative: mod.relative,
    dirname: mod.dirname,
    basename: mod.basename,
    isAbsolute: mod.isAbsolute,
    sep: mod.sep,
  }
}
