import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import {
  isWrongPlatformBinding,
  parseCompiledModuleVersion,
  probeNativeBinding,
  rebuildTarget,
} from '../scripts/sqlite-abi-policy.mjs'

describe('SQLite ABI lifecycle', () => {
  it('opens and closes a real in-memory database instead of only requiring the JS wrapper', () => {
    const close = vi.fn()
    const openDatabase = vi.fn((filename: string) => {
      expect(filename).toBe(':memory:')
      return { close }
    })
    const result = probeNativeBinding(openDatabase)
    expect(openDatabase).toHaveBeenCalledTimes(1)
    expect(openDatabase).toHaveBeenCalledWith(':memory:')
    expect(close).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('treats a failed in-memory open as a failed native probe', () => {
    const error = Object.assign(new Error('slice is not valid mach-o file'), {
      code: 'ERR_DLOPEN_FAILED',
    })
    const result = probeNativeBinding(() => {
      throw error
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe(error)
  })

  it('rebuilds Node when the native binary is the wrong platform', () => {
    const error = Object.assign(new Error('slice is not valid mach-o file'), {
      code: 'ERR_DLOPEN_FAILED',
    })
    expect(isWrongPlatformBinding(error)).toBe(true)
    expect(
      rebuildTarget({
        target: 'node',
        probeOk: false,
        compiledModules: undefined,
        electronModules: '133',
        wrongPlatform: true,
      }),
    ).toBe('node')
  })

  it('rebuilds Node when the native module cannot open a database', () => {
    expect(
      rebuildTarget({
        target: 'node',
        probeOk: false,
        compiledModules: '133',
        electronModules: '133',
      }),
    ).toBe('node')
    expect(
      rebuildTarget({
        target: 'node',
        probeOk: true,
        compiledModules: '137',
        electronModules: '133',
      }),
    ).toBeNull()
  })

  it('skips rebuild when a real in-memory database already opens', () => {
    expect(
      rebuildTarget({
        target: 'electron',
        probeOk: true,
        compiledModules: '137',
        electronModules: '149',
      }),
    ).toBeNull()
    expect(
      rebuildTarget({
        target: 'node',
        probeOk: true,
        compiledModules: '137',
        electronModules: '149',
      }),
    ).toBeNull()
  })

  it('rebuilds for Electron when Node cannot open the binding unless it is already Electron ABI', () => {
    expect(
      rebuildTarget({
        target: 'electron',
        probeOk: false,
        compiledModules: '133',
        electronModules: '133',
      }),
    ).toBeNull()
    expect(
      rebuildTarget({
        target: 'electron',
        probeOk: false,
        compiledModules: undefined,
        electronModules: '149',
        wrongPlatform: true,
      }),
    ).toBe('electron')
    expect(
      rebuildTarget({
        target: 'electron',
        probeOk: false,
        compiledModules: '137',
        electronModules: '149',
      }),
    ).toBe('electron')
  })

  it('parses NODE_MODULE_VERSION from the native load error', () => {
    expect(
      parseCompiledModuleVersion(
        'was compiled against NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 133.',
      ),
    ).toBe('137')
  })

  it('wires supported npm scripts to prepare the matching ABI automatically', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts.dev).toContain('ensure-sqlite-abi.mjs electron')
    expect(pkg.scripts.test).toContain('ensure-sqlite-abi.mjs node')
    expect(pkg.scripts['package:dir']).toContain('electron-builder')
    expect(pkg.scripts['package:win']).toContain('electron-builder --win')
  })

  it('can construct an in-memory better-sqlite3 database in this Node process', () => {
    const db = new Database(':memory:')
    expect(db.prepare('SELECT 1 AS n').get()).toEqual({ n: 1 })
    db.close()
  })
})
