import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isWrongPlatformBinding,
  parseCompiledModuleVersion,
  probeNativeBinding,
  rebuildTarget,
} from './sqlite-abi-policy.mjs'

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2]

if (target !== 'node' && target !== 'electron') {
  console.error('Usage: node scripts/ensure-sqlite-abi.mjs <node|electron>')
  process.exit(1)
}

function inspectNativeBinding() {
  try {
    const Database = require('better-sqlite3')
    const result = probeNativeBinding((filename) => new Database(filename))
    if (result.ok) {
      return {
        probeOk: true,
        compiledModules: process.versions.modules,
        wrongPlatform: false,
      }
    }
    return describeFailure(result.error)
  } catch (error) {
    return describeFailure(error)
  }
}

function describeFailure(error) {
  const message = error instanceof Error ? error.message : String(error)
  return {
    probeOk: false,
    compiledModules: parseCompiledModuleVersion(message),
    wrongPlatform: isWrongPlatformBinding(error),
  }
}

function electronModules() {
  const { getAbi } = require('node-abi')
  const version = String(require('electron/package.json').version).replace(/^v/, '')
  return String(getAbi(version, 'electron'))
}

function ensureElectronBinary() {
  // Electron 44+ downloads its binary lazily; electron-vite looks for path.txt.
  require('electron')
}

if (target === 'electron') {
  ensureElectronBinary()
}

const inspection = inspectNativeBinding()
const needed = rebuildTarget({
  target,
  probeOk: inspection.probeOk,
  compiledModules: inspection.compiledModules,
  electronModules: electronModules(),
  wrongPlatform: inspection.wrongPlatform,
})

if (!needed) {
  process.exit(0)
}

if (needed === 'node') {
  execSync('npm rebuild better-sqlite3', { cwd: root, stdio: 'inherit', env: process.env })
  process.exit(0)
}

const { rebuild } = require('@electron/rebuild')
await rebuild({
  buildPath: root,
  electronVersion: String(require('electron/package.json').version).replace(/^v/, ''),
  force: true,
  onlyModules: ['better-sqlite3'],
})
