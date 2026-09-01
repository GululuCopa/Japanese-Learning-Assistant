import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isPathInside,
  resolveUnderVault,
  sanitizeWindowsFileName,
  uniqueRelPath,
} from '../src/main/obsidian/paths'

const win = {
  join: path.win32.join,
  resolve: path.win32.resolve,
  relative: path.win32.relative,
  dirname: path.win32.dirname,
  basename: path.win32.basename,
  isAbsolute: path.win32.isAbsolute,
  sep: path.win32.sep,
}

describe('Windows-safe Obsidian paths', () => {
  it('sanitizes reserved names and invalid characters', () => {
    expect(sanitizeWindowsFileName('構う')).toBe('構う')
    expect(sanitizeWindowsFileName('a<b>|c?.md')).toBe('a_b__c_.md')
    expect(sanitizeWindowsFileName('CON')).toBe('CON_')
    expect(sanitizeWindowsFileName('aux.txt')).toBe('aux_.txt')
  })

  it('rejects traversal outside the vault', () => {
    const vault = 'D:\\Obsidian\\MyVault'
    expect(isPathInside(vault, 'D:\\Obsidian\\MyVault\\Japanese\\Words\\構う.md', win)).toBe(true)
    expect(isPathInside(vault, 'D:\\Obsidian\\Other\\x.md', win)).toBe(false)
    expect(isPathInside(vault, 'D:\\Obsidian\\MyVault\\..\\Windows\\x.md', win)).toBe(false)
    expect(() => resolveUnderVault(vault, ['..', 'Windows', 'x.md'], win)).toThrow(/仓库内/)
  })

  it('avoids uncontrolled collisions', () => {
    expect(uniqueRelPath('構う.md', new Set(['構う.md']))).toBe('構う-2.md')
  })
})
