import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { KOKORO_HOST, KOKORO_PORT_FALLBACKS, KOKORO_PREFERRED_PORT } from '@shared/constants'
import { ProviderError } from '@shared/errors'

export interface KokoroReady {
  baseUrl: string
  port: number
  reused: boolean
}

export interface SpawnedProcess {
  pid?: number
  kill(): void
}

export interface KokoroRuntimeDeps {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  isPackaged?: boolean
  resourcesPath?: string
  userDataDir: string
  appRoot: string
  fetchImpl?: typeof fetch
  spawnProcess?: (
    command: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv },
  ) => SpawnedProcess
  isPortOpen?: (port: number) => Promise<boolean>
  fileExists?: (filePath: string) => boolean
  readinessTimeoutMs?: number
  pollIntervalMs?: number
}

export class KokoroRuntime {
  private child: SpawnedProcess | undefined
  private ready: KokoroReady | undefined
  private readonly env: NodeJS.ProcessEnv
  private readonly platform: NodeJS.Platform
  private readonly fetchImpl: typeof fetch
  private readonly spawnProcess: NonNullable<KokoroRuntimeDeps['spawnProcess']>
  private readonly isPortOpen: (port: number) => Promise<boolean>
  private readonly fileExists: (filePath: string) => boolean

  constructor(private readonly deps: KokoroRuntimeDeps) {
    this.env = deps.env ?? process.env
    this.platform = deps.platform ?? process.platform
    this.fetchImpl = deps.fetchImpl ?? fetch
    this.spawnProcess = deps.spawnProcess ?? defaultSpawn
    this.isPortOpen = deps.isPortOpen ?? isPortOpen
    this.fileExists = deps.fileExists ?? ((filePath) => fs.existsSync(filePath))
  }

  async ensureReady(): Promise<KokoroReady> {
    if (this.ready) {
      if (await this.isHealthy(this.ready.port)) {
        return this.ready
      }
      this.stop()
    }

    const existing = await this.findHealthyPort()
    if (existing !== undefined) {
      this.ready = {
        baseUrl: `http://${KOKORO_HOST}:${existing}/v1`,
        port: existing,
        reused: true,
      }
      return this.ready
    }

    const launch = this.resolveLaunch()
    if (!launch) {
      throw new ProviderError(
        'configuration',
        this.placeholderOnlyRoot()
          ? '本地 Kokoro 仅有启动脚本，未安装运行时或日语模型。请按 resources/kokoro/README.md 将 start-cpu、可执行文件或 Python venv 放到应用资源目录、userData/kokoro-runtime，或设置 JLA_KOKORO_BIN。分析功能仍可使用。'
          : '未找到本地 Kokoro 语音引擎。请按 README 安装 Kokoro-FastAPI 运行时和日语模型后重试。分析功能仍可使用。',
        false,
      )
    }

    const port = await this.chooseFreePort()

    try {
      this.child = this.spawnProcess(
        launch.command,
        [...launch.args, ...hostPortArgs(launch, port)],
        {
          cwd: launch.cwd,
          env: kokoroChildEnv(this.env, port),
        },
      )
    } catch {
      throw new ProviderError(
        'configuration',
        '无法启动本地 Kokoro 语音引擎。请检查运行时路径后重试。',
        false,
      )
    }

    const timeout = this.deps.readinessTimeoutMs ?? 20_000
    const interval = this.deps.pollIntervalMs ?? 250
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await this.isHealthy(port)) {
        this.ready = {
          baseUrl: `http://${KOKORO_HOST}:${port}/v1`,
          port,
          reused: false,
        }
        return this.ready
      }
      await sleep(interval)
    }
    this.stop()
    throw new ProviderError(
      'network',
      '本地 Kokoro 语音引擎启动超时。请确认模型文件已安装，然后重试发音。',
      true,
    )
  }

  stop(): void {
    const child = this.child
    this.child = undefined
    this.ready = undefined
    try {
      child?.kill()
    } catch {
      // Best-effort cleanup of the process we spawned.
    }
  }

  resolveLaunch(): { command: string; args: string[]; cwd?: string } | undefined {
    const bin = this.env.JLA_KOKORO_BIN?.trim()
    if (bin) {
      if (!path.isAbsolute(bin) || !this.fileExists(bin)) {
        return undefined
      }
      return {
        command: bin,
        args: parseDeveloperArgs(this.env.JLA_KOKORO_ARGS),
        cwd: path.dirname(bin),
      }
    }

    for (const root of this.runtimeRoots()) {
      const launcher = this.launcherIn(root)
      if (!launcher) continue
      if (launcher.kind === 'powershell') {
        return {
          command: powershellExecutable(this.env),
          args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcher.filePath],
          cwd: root,
        }
      }
      if (launcher.kind === 'bash') {
        return {
          command: '/bin/bash',
          args: [launcher.filePath],
          cwd: root,
        }
      }
      return {
        command: launcher.filePath,
        args: [],
        cwd: root,
      }
    }
    return undefined
  }

  private runtimeRoots(): string[] {
    const roots: string[] = []
    const overrideDir = this.env.JLA_KOKORO_RUNTIME?.trim()
    if (overrideDir && path.isAbsolute(overrideDir)) {
      roots.push(overrideDir)
    }
    if (this.deps.isPackaged && this.deps.resourcesPath) {
      roots.push(path.join(this.deps.resourcesPath, 'kokoro'))
    }
    roots.push(path.join(this.deps.userDataDir, 'kokoro-runtime'))
    roots.push(path.join(this.deps.appRoot, 'resources', 'kokoro'))
    return roots
  }

  private launcherIn(
    root: string,
  ): { filePath: string; kind: 'powershell' | 'bash' | 'bin' } | undefined {
    const candidates =
      this.platform === 'win32'
        ? [
            { name: 'launch.ps1', kind: 'powershell' as const },
            { name: 'start-cpu.ps1', kind: 'powershell' as const },
            { name: 'kokoro-fastapi.exe', kind: 'bin' as const },
          ]
        : [
            { name: 'launch.sh', kind: 'bash' as const },
            { name: 'start-cpu.sh', kind: 'bash' as const },
            { name: 'kokoro-fastapi', kind: 'bin' as const },
          ]
    for (const candidate of candidates) {
      const filePath = path.join(root, candidate.name)
      if (!this.fileExists(filePath)) continue
      if (candidate.name.startsWith('launch.') && !this.hasBackingRuntime(root)) {
        continue
      }
      return { filePath, kind: candidate.kind }
    }
    return undefined
  }

  private backingNames(): string[] {
    return this.platform === 'win32'
      ? [
          'start-cpu.ps1',
          'kokoro-fastapi.exe',
          path.join('python', 'python.exe'),
          path.join('venv', 'Scripts', 'python.exe'),
          path.join('.venv', 'Scripts', 'python.exe'),
        ]
      : [
          'start-cpu.sh',
          'kokoro-fastapi',
          path.join('venv', 'bin', 'python'),
          path.join('.venv', 'bin', 'python'),
        ]
  }

  private hasBackingRuntime(root: string): boolean {
    return this.backingNames().some((name) => this.fileExists(path.join(root, name)))
  }

  private placeholderOnlyRoot(): boolean {
    const launchName = this.platform === 'win32' ? 'launch.ps1' : 'launch.sh'
    return this.runtimeRoots().some((root) => {
      return this.fileExists(path.join(root, launchName)) && !this.hasBackingRuntime(root)
    })
  }

  private preferredPort(): number {
    return Number(this.env.JLA_KOKORO_PORT) || KOKORO_PREFERRED_PORT
  }

  private async findHealthyPort(): Promise<number | undefined> {
    const preferred = this.preferredPort()
    for (let offset = 0; offset <= KOKORO_PORT_FALLBACKS; offset += 1) {
      const port = preferred + offset
      if (await this.isHealthy(port)) return port
    }
    return undefined
  }

  private async chooseFreePort(): Promise<number> {
    const preferred = this.preferredPort()
    for (let offset = 0; offset <= KOKORO_PORT_FALLBACKS; offset += 1) {
      const port = preferred + offset
      const occupied = await this.isPortOpen(port)
      if (!occupied) return port
    }
    throw new ProviderError(
      'configuration',
      `本地端口 ${preferred}–${preferred + KOKORO_PORT_FALLBACKS} 均被占用，无法启动语音引擎。`,
      false,
    )
  }

  private async isHealthy(port: number): Promise<boolean> {
    for (const suffix of ['/health', '/v1/models']) {
      try {
        const response = await this.fetchImpl(`http://${KOKORO_HOST}:${port}${suffix}`, {
          method: 'GET',
        })
        if (response.ok) return true
      } catch {
        // Try the next probe path.
      }
    }
    return false
  }
}

function hostPortArgs(launch: { command: string; args: string[] }, port: number): string[] {
  if (launch.command.toLowerCase().includes('powershell') || launch.args.includes('-File')) {
    return ['-HostAddress', KOKORO_HOST, '-Port', String(port)]
  }
  if (launch.command === '/bin/bash') {
    return [KOKORO_HOST, String(port)]
  }
  return ['--host', KOKORO_HOST, '--port', String(port)]
}

function parseDeveloperArgs(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      return []
    }
    return parsed
  } catch {
    return []
  }
}

function powershellExecutable(env: NodeJS.ProcessEnv): string {
  const root = env.SystemRoot || env.windir
  if (root) {
    return path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  }
  return 'powershell.exe'
}

export function kokoroChildEnv(base: NodeJS.ProcessEnv, port: number): NodeJS.ProcessEnv {
  return {
    ...base,
    KOKORO_HOST,
    KOKORO_PORT: String(port),
    HOST: KOKORO_HOST,
    PORT: String(port),
  }
}

function defaultSpawn(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv },
): SpawnedProcess {
  const child: ChildProcess = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: 'ignore',
    windowsHide: true,
  })
  return {
    pid: child.pid,
    kill() {
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        })
        return
      }
      child.kill()
    },
  }
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: KOKORO_HOST, port }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => {
      resolve(false)
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
