import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ProviderError } from '../src/shared/errors'
import { kokoroChildEnv, KokoroRuntime } from '../src/main/tts/kokoro-runtime'
import { tempDir } from './helpers/app'

describe('Kokoro runtime lifecycle', () => {
  it('rejects a placeholder-only launcher root before spawn', async () => {
    const spawnProcess = vi.fn()
    const appRoot = tempDir('jla-app-')
    const kokoroDir = path.join(appRoot, 'resources', 'kokoro')
    fs.mkdirSync(kokoroDir, { recursive: true })
    fs.writeFileSync(path.join(kokoroDir, 'launch.sh'), '#!/bin/bash\nexit 1\n')
    fs.writeFileSync(path.join(kokoroDir, 'README.md'), 'Local Kokoro runtime (not bundled)\n')
    const runtime = new KokoroRuntime({
      userDataDir: tempDir('jla-kokoro-'),
      appRoot,
      spawnProcess,
      isPortOpen: async () => false,
      fetchImpl: vi.fn() as unknown as typeof fetch,
      readinessTimeoutMs: 400,
      pollIntervalMs: 50,
    })
    const started = Date.now()
    await expect(runtime.ensureReady()).rejects.toMatchObject({
      code: 'configuration',
      retryable: false,
      message: expect.stringMatching(/启动脚本|未安装/),
    })
    expect(Date.now() - started).toBeLessThan(1000)
    expect(spawnProcess).not.toHaveBeenCalled()
  })

  it('spawns when a placeholder launcher has a backing start-cpu script', async () => {
    const spawnProcess = vi.fn(() => ({ pid: 11, kill: () => undefined }))
    const appRoot = tempDir('jla-app-')
    const kokoroDir = path.join(appRoot, 'resources', 'kokoro')
    fs.mkdirSync(kokoroDir, { recursive: true })
    fs.writeFileSync(path.join(kokoroDir, 'launch.sh'), '#!/bin/bash\n')
    fs.writeFileSync(path.join(kokoroDir, 'start-cpu.sh'), '#!/bin/bash\n')
    const runtime = new KokoroRuntime({
      userDataDir: tempDir('jla-kokoro-'),
      appRoot,
      spawnProcess,
      isPortOpen: async () => false,
      fetchImpl: vi.fn(async () =>
        spawnProcess.mock.calls.length
          ? new Response('ok', { status: 200 })
          : new Response('no', { status: 503 }),
      ) as unknown as typeof fetch,
      readinessTimeoutMs: 200,
      pollIntervalMs: 10,
    })
    await runtime.ensureReady()
    expect(spawnProcess).toHaveBeenCalled()
    runtime.stop()
  })

  it('returns a configuration error when no runtime is present and does not spawn', async () => {
    const spawnProcess = vi.fn()
    const runtime = new KokoroRuntime({
      userDataDir: tempDir('jla-kokoro-'),
      appRoot: tempDir('jla-app-'),
      fileExists: () => false,
      spawnProcess,
      isPortOpen: async () => false,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })
    await expect(runtime.ensureReady()).rejects.toMatchObject({
      code: 'configuration',
    } satisfies Partial<ProviderError>)
    expect(spawnProcess).not.toHaveBeenCalled()
  })

  it('reuses a healthy local port without spawning', async () => {
    const spawnProcess = vi.fn()
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/health')) {
        return new Response('ok', { status: 200 })
      }
      return new Response('no', { status: 404 })
    }) as unknown as typeof fetch
    const runtime = new KokoroRuntime({
      userDataDir: tempDir('jla-kokoro-'),
      appRoot: tempDir('jla-app-'),
      fileExists: () => false,
      spawnProcess,
      isPortOpen: async () => true,
      fetchImpl,
    })
    const ready = await runtime.ensureReady()
    expect(ready.reused).toBe(true)
    expect(ready.baseUrl).toBe('http://127.0.0.1:8880/v1')
    expect(spawnProcess).not.toHaveBeenCalled()
    runtime.stop()
  })

  it('spawns once, waits for readiness, and kills only the child it created', async () => {
    const killed: number[] = []
    const spawnProcess = vi.fn(() => ({
      pid: 4242,
      kill: () => {
        killed.push(4242)
      },
    }))
    let healthy = false
    const fetchImpl = vi.fn(async () => {
      return new Response(healthy ? 'ok' : 'no', { status: healthy ? 200 : 503 })
    }) as unknown as typeof fetch
    const runtime = new KokoroRuntime({
      userDataDir: tempDir('jla-kokoro-'),
      appRoot: tempDir('jla-app-'),
      env: { JLA_KOKORO_BIN: '/abs/kokoro' },
      fileExists: (filePath) => filePath === '/abs/kokoro',
      spawnProcess,
      isPortOpen: async () => false,
      fetchImpl,
      readinessTimeoutMs: 500,
      pollIntervalMs: 20,
    })
    const pending = runtime.ensureReady()
    await new Promise((resolve) => setTimeout(resolve, 40))
    healthy = true
    const ready = await pending
    expect(ready.reused).toBe(false)
    expect(spawnProcess).toHaveBeenCalledTimes(1)
    runtime.stop()
    expect(killed).toEqual([4242])
  })

  it('times out readiness with a retryable network error and cleans up', async () => {
    const killed: number[] = []
    const runtime = new KokoroRuntime({
      userDataDir: tempDir('jla-kokoro-'),
      appRoot: tempDir('jla-app-'),
      env: { JLA_KOKORO_BIN: '/abs/kokoro' },
      fileExists: (filePath) => filePath === '/abs/kokoro',
      spawnProcess: () => ({
        pid: 7,
        kill: () => {
          killed.push(7)
        },
      }),
      isPortOpen: async () => false,
      fetchImpl: vi.fn(async () => new Response('no', { status: 503 })) as unknown as typeof fetch,
      readinessTimeoutMs: 40,
      pollIntervalMs: 10,
    })
    await expect(runtime.ensureReady()).rejects.toMatchObject({
      code: 'network',
      retryable: true,
    } satisfies Partial<ProviderError>)
    expect(killed).toEqual([7])
  })

  it('forwards the selected fallback port in spawn env for the child process', async () => {
    let spawned = false
    const spawnProcess = vi.fn(
      (_command: string, _args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv }) => {
        expect(options.env?.KOKORO_HOST).toBe('127.0.0.1')
        expect(options.env?.KOKORO_PORT).toBe('8881')
        expect(options.env?.HOST).toBe('127.0.0.1')
        expect(options.env?.PORT).toBe('8881')
        spawned = true
        return { pid: 9, kill: () => undefined }
      },
    )
    const runtime = new KokoroRuntime({
      userDataDir: tempDir('jla-kokoro-'),
      appRoot: tempDir('jla-app-'),
      env: { JLA_KOKORO_BIN: '/abs/kokoro' },
      fileExists: (filePath) => filePath === '/abs/kokoro',
      spawnProcess,
      isPortOpen: async (port) => port === 8880,
      fetchImpl: vi.fn(async () =>
        spawned ? new Response('ok', { status: 200 }) : new Response('no', { status: 503 }),
      ) as unknown as typeof fetch,
      readinessTimeoutMs: 200,
      pollIntervalMs: 10,
    })
    await runtime.ensureReady()
    expect(spawnProcess).toHaveBeenCalled()
    runtime.stop()
  })

  it('launch wrappers set KOKORO_HOST/KOKORO_PORT before delegating to start-cpu scripts', () => {
    const ps1 = fs.readFileSync(path.join(process.cwd(), 'resources/kokoro/launch.ps1'), 'utf8')
    const sh = fs.readFileSync(path.join(process.cwd(), 'resources/kokoro/launch.sh'), 'utf8')
    const ps1Start = ps1.indexOf('& $startCpu')
    const shStart = sh.search(/exec .*start-cpu\.sh/)
    expect(ps1Start).toBeGreaterThan(0)
    expect(shStart).toBeGreaterThan(0)
    expect(ps1.slice(0, ps1Start)).toMatch(/\$env:KOKORO_HOST\s*=/)
    expect(ps1.slice(0, ps1Start)).toMatch(/\$env:KOKORO_PORT\s*=/)
    expect(ps1.slice(0, ps1Start)).toMatch(/\$env:PORT\s*=/)
    expect(sh.slice(0, shStart)).toMatch(/export KOKORO_HOST=/)
    expect(sh.slice(0, shStart)).toMatch(/export KOKORO_PORT=/)
    expect(sh.slice(0, shStart)).toMatch(/export PORT=/)
    expect(sh).toMatch(/start-cpu\.sh" "\$HOST" "\$PORT"/)
    expect(kokoroChildEnv({}, 8881).KOKORO_PORT).toBe('8881')
    expect(kokoroChildEnv({}, 8881).PORT).toBe('8881')
  })
})
