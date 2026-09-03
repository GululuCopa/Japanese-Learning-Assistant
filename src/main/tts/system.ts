import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { TTSProvider } from '@shared/contracts'
import { ProviderError } from '@shared/errors'
import { normalizeVoiceGender } from '@shared/tts'
import type { AudioResult, TTSOptions, VoiceGender } from '@shared/types'
import { audioCacheKey } from './cache'

export const SYSTEM_TTS_TIMEOUT_MS = 30_000

const MAC_SAY = '/usr/bin/say'
const MAC_AFCONVERT = '/usr/bin/afconvert'
const MAC_MISSING_VOICE = '未找到 macOS 日语系统语音，请先在系统设置中下载日语语音后重试。'
const WIN_MISSING_VOICE =
  '未找到 Windows 日语系统语音，请先在 Windows 语言设置中安装日语语音包后重试。'
const UNSUPPORTED_PLATFORM = '系统语音发音目前仅支持 Windows 和 macOS。'
const EMPTY_TEXT = '没有可朗读的文本'
const GENERIC_FAILURE = '系统语音生成失败，请确认已安装日语语音后重试。'
const TIMEOUT_MESSAGE = '语音生成超时，请重试。'
const NO_JA_VOICE_TOKEN = 'JLA_TTS_NO_JA_VOICE'

const FEMALE_VOICE_NAMES = ['Kyoko', 'Flo', 'Sandy', 'Shelley', 'Grandma'] as const
const MALE_VOICE_NAMES = ['Otoya', 'Eddy', 'Reed', 'Rocko', 'Grandpa'] as const

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export type RunCommand = (
  command: string,
  args: readonly string[],
  options: { timeoutMs: number },
) => Promise<CommandResult>

export interface SystemTTSProviderOptions {
  cacheDir: string
  platform?: NodeJS.Platform
  runCommand?: RunCommand
  tmpDir?: string
  timeoutMs?: number
  randomId?: () => string
}

export class SystemTTSProvider implements TTSProvider {
  private readonly platform: NodeJS.Platform
  private readonly cacheDir: string
  private readonly tmpDir: string
  private readonly timeoutMs: number
  private readonly runCommand: RunCommand
  private readonly randomId: () => string
  private macVoices?: Array<{ name: string; locale: string }>

  constructor(options: SystemTTSProviderOptions) {
    this.platform = options.platform ?? process.platform
    this.cacheDir = options.cacheDir
    this.tmpDir = options.tmpDir ?? os.tmpdir()
    this.timeoutMs = options.timeoutMs ?? SYSTEM_TTS_TIMEOUT_MS
    this.runCommand = options.runCommand ?? runTimedCommand
    this.randomId = options.randomId ?? (() => crypto.randomUUID())
  }

  async speak(text: string, options?: TTSOptions): Promise<AudioResult> {
    const trimmed = text.trim()
    if (!trimmed) {
      throw new ProviderError('invalid_response', EMPTY_TEXT, false)
    }
    if (this.platform !== 'darwin' && this.platform !== 'win32') {
      throw new ProviderError('configuration', UNSUPPORTED_PLATFORM, false)
    }

    const voiceGender = normalizeVoiceGender(options?.voiceGender)
    const temps: string[] = []
    try {
      if (this.platform === 'darwin') {
        return await this.speakMac(trimmed, voiceGender, temps)
      }
      return await this.speakWindows(trimmed, voiceGender, temps)
    } finally {
      for (const filePath of temps) {
        try {
          fs.unlinkSync(filePath)
        } catch {
          // Request-scoped temps must not survive success, failure, or timeout.
        }
      }
    }
  }

  private async speakMac(
    text: string,
    voiceGender: VoiceGender,
    temps: string[],
  ): Promise<AudioResult> {
    const voice = await this.resolveMacVoice(voiceGender)
    const cached = this.readCache(this.cacheDir, this.platform, voice, voiceGender, text)
    if (cached) return cached

    fs.mkdirSync(this.tmpDir, { recursive: true })
    const id = this.randomId()
    const aiffPath = path.join(this.tmpDir, `jla-tts-${id}.aiff`)
    const wavPath = path.join(this.tmpDir, `jla-tts-${id}.wav`)
    temps.push(aiffPath, wavPath)

    const sayResult = await this.run(MAC_SAY, ['-v', voice, '-o', aiffPath, text])
    this.throwIfFailed(sayResult)
    const convertResult = await this.run(MAC_AFCONVERT, [
      '-f',
      'WAVE',
      '-d',
      'LEI16@22050',
      aiffPath,
      wavPath,
    ])
    this.throwIfFailed(convertResult)
    return this.finishWav(wavPath, this.platform, voice, voiceGender, text)
  }

  private async speakWindows(
    text: string,
    voiceGender: VoiceGender,
    temps: string[],
  ): Promise<AudioResult> {
    const voice = `ja-${voiceGender}`
    const cached = this.readCache(this.cacheDir, this.platform, voice, voiceGender, text)
    if (cached) return cached

    fs.mkdirSync(this.tmpDir, { recursive: true })
    const id = this.randomId()
    const textPath = path.join(this.tmpDir, `jla-tts-${id}.txt`)
    const wavPath = path.join(this.tmpDir, `jla-tts-${id}.wav`)
    const scriptPath = path.join(this.tmpDir, `jla-tts-${id}.ps1`)
    temps.push(textPath, wavPath, scriptPath)
    fs.writeFileSync(textPath, text, 'utf8')
    fs.writeFileSync(scriptPath, buildWindowsSpeechScript(textPath, wavPath, voiceGender), 'utf8')

    const result = await this.runPowershell(scriptPath)
    if (result.exitCode === 2 || result.stderr.includes(NO_JA_VOICE_TOKEN)) {
      throw new ProviderError('configuration', WIN_MISSING_VOICE, false)
    }
    this.throwIfFailed(result)
    return this.finishWav(wavPath, this.platform, voice, voiceGender, text)
  }

  private async resolveMacVoice(voiceGender: VoiceGender): Promise<string> {
    const voices = await this.listMacVoices()
    const selected = selectMacJapaneseVoice(voices, voiceGender)
    if (!selected) {
      throw new ProviderError('configuration', MAC_MISSING_VOICE, false)
    }
    return selected
  }

  private async listMacVoices(): Promise<Array<{ name: string; locale: string }>> {
    if (this.macVoices) return this.macVoices
    const result = await this.run(MAC_SAY, ['-v', '?'])
    this.throwIfFailed(result)
    this.macVoices = parseSayVoices(result.stdout)
    return this.macVoices
  }

  private async runPowershell(scriptPath: string): Promise<CommandResult> {
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
    ]
    try {
      return await this.run('powershell.exe', args)
    } catch (error) {
      if (error instanceof CommandNotFoundError) {
        return await this.run('powershell', args)
      }
      throw error
    }
  }

  private async run(command: string, args: readonly string[]): Promise<CommandResult> {
    return await withTimeout(
      this.runCommand(command, args, { timeoutMs: this.timeoutMs }),
      this.timeoutMs,
    )
  }

  private throwIfFailed(result: CommandResult): void {
    if (result.exitCode === 0) return
    throw new ProviderError('unknown', GENERIC_FAILURE, true)
  }

  private readCache(
    cacheDir: string,
    platform: string,
    voice: string,
    voiceGender: VoiceGender,
    text: string,
  ): AudioResult | undefined {
    const filePath = cacheFile(cacheDir, platform, voice, voiceGender, text)
    if (!fs.existsSync(filePath)) return undefined
    return {
      mimeType: 'audio/wav',
      bytes: fs.readFileSync(filePath),
      cached: true,
    }
  }

  private finishWav(
    wavPath: string,
    platform: string,
    voice: string,
    voiceGender: VoiceGender,
    text: string,
  ): AudioResult {
    if (!fs.existsSync(wavPath)) {
      throw new ProviderError('unknown', GENERIC_FAILURE, true)
    }
    const bytes = fs.readFileSync(wavPath)
    if (bytes.byteLength === 0) {
      throw new ProviderError('invalid_response', GENERIC_FAILURE, true)
    }
    writeCacheAtomic(
      cacheFile(this.cacheDir, platform, voice, voiceGender, text),
      bytes,
      this.randomId,
    )
    return { mimeType: 'audio/wav', bytes, cached: false }
  }
}

export async function runTimedCommand(
  command: string,
  args: readonly string[],
  options: { timeoutMs: number },
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(command, [...args], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk))

    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killSpawned(child)
    }, options.timeoutMs)

    child.on('error', (error) => {
      clearTimeout(timer)
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new CommandNotFoundError())
        return
      }
      reject(new ProviderError('unknown', GENERIC_FAILURE, true))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        reject(new ProviderError('unknown', TIMEOUT_MESSAGE, true))
        return
      }
      resolve({
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        exitCode: code ?? 1,
      })
    })
  })
}

class CommandNotFoundError extends ProviderError {
  constructor() {
    super('configuration', GENERIC_FAILURE, false)
    this.name = 'CommandNotFoundError'
  }
}

function parseSayVoices(stdout: string): Array<{ name: string; locale: string }> {
  const voices: Array<{ name: string; locale: string }> = []
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^(.*?)\s+([a-z]{2}_[A-Z]{2})\s+#/)
    if (!match?.[1] || !match[2]) continue
    voices.push({ name: match[1].trim(), locale: match[2] })
  }
  return voices
}

function selectMacJapaneseVoice(
  voices: Array<{ name: string; locale: string }>,
  gender: VoiceGender,
): string | undefined {
  const japanese = voices.filter((voice) => voice.locale === 'ja_JP')
  if (japanese.length === 0) return undefined
  const preferred = gender === 'male' ? MALE_VOICE_NAMES : FEMALE_VOICE_NAMES
  for (const known of preferred) {
    const match = japanese.find((voice) => voiceNameMatches(voice.name, known))
    if (match) return match.name
  }
  return japanese[0]?.name
}

function voiceNameMatches(actual: string, known: string): boolean {
  return actual === known || actual.startsWith(`${known} `) || actual.startsWith(`${known}(`)
}

function buildWindowsSpeechScript(textPath: string, wavPath: string, gender: VoiceGender): string {
  const genderEnum = gender === 'male' ? 'Male' : 'Female'
  return [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Speech',
    '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    'try {',
    `  $text = [System.IO.File]::ReadAllText(${psQuote(textPath)}, [System.Text.Encoding]::UTF8)`,
    "  $japanese = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name.StartsWith('ja') })",
    '  if ($japanese.Count -eq 0) {',
    `    [Console]::Error.WriteLine('${NO_JA_VOICE_TOKEN}')`,
    '    exit 2',
    '  }',
    `  $wanted = [System.Speech.Synthesis.VoiceGender]::${genderEnum}`,
    '  $match = @($japanese | Where-Object { $_.VoiceInfo.Gender -eq $wanted } | Select-Object -First 1)',
    '  if ($match.Count -eq 0) {',
    '    $match = @($japanese | Select-Object -First 1)',
    '  }',
    '  $synth.SelectVoice($match[0].VoiceInfo.Name)',
    `  $synth.SetOutputToWaveFile(${psQuote(wavPath)})`,
    '  $synth.Speak($text)',
    '} finally {',
    '  if ($synth) { $synth.Dispose() }',
    '}',
    '',
  ].join('\n')
}

function psQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function cacheFile(
  cacheDir: string,
  platform: string,
  voice: string,
  voiceGender: VoiceGender,
  text: string,
): string {
  const key = audioCacheKey({
    provider: 'system-tts',
    model: platform,
    voice,
    voiceGender,
    speed: 1,
    text,
  })
  return path.join(cacheDir, `${key}.wav`)
}

function writeCacheAtomic(filePath: string, bytes: Buffer, randomId: () => string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${randomId()}.tmp`
  try {
    fs.writeFileSync(tempPath, bytes)
    fs.renameSync(tempPath, filePath)
  } catch {
    try {
      fs.unlinkSync(tempPath)
    } catch {
      // Leave any previous valid cache file untouched.
    }
  }
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ProviderError('unknown', TIMEOUT_MESSAGE, true))
    }, timeoutMs)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function killSpawned(child: ChildProcess): void {
  if (!child.pid) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    })
    return
  }
  child.kill('SIGKILL')
}
