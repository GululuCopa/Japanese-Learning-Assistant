export function parseCompiledModuleVersion(message) {
  const match = String(message).match(/compiled against NODE_MODULE_VERSION (\d+)/)
  return match ? match[1] : undefined
}

export function isWrongPlatformBinding(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const code = error && typeof error === 'object' ? error.code : undefined
  if (code === 'ERR_DLOPEN_FAILED') {
    return true
  }
  return (
    /not valid mach-o/i.test(message) ||
    /invalid ELF/i.test(message) ||
    /wrong ELF class/i.test(message) ||
    /not a valid Win32 application/i.test(message) ||
    /incompatible architecture/i.test(message)
  )
}

export function probeNativeBinding(openDatabase) {
  let db
  try {
    db = openDatabase(':memory:')
    if (!db || typeof db.close !== 'function') {
      throw new Error('better-sqlite3 probe did not return a database with close()')
    }
    db.close()
    return { ok: true }
  } catch (error) {
    try {
      db?.close?.()
    } catch {
      // Ignore close failures after a failed open.
    }
    return { ok: false, error }
  }
}

export function rebuildTarget({
  target,
  probeOk,
  compiledModules,
  electronModules,
  wrongPlatform = false,
}) {
  if (target !== 'node' && target !== 'electron') {
    throw new Error(`Unknown SQLite ABI target: ${target}`)
  }
  if (probeOk) {
    // N-API prebuilds (better-sqlite3 13+) load in both Node and Electron.
    return null
  }
  if (target === 'node') {
    return 'node'
  }
  if (wrongPlatform) {
    return 'electron'
  }
  if (compiledModules && compiledModules === electronModules) {
    return null
  }
  return 'electron'
}
