import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { IpcMain } from 'electron'
import { ProviderError } from '../src/shared/errors'
import { IPC_CHANNELS } from '../src/shared/constants'
import { registerIpc } from '../src/main/ipc/register'
import type { AppServices } from '../src/main/app-services'
import { runTimedCommand, SystemTTSProvider, type RunCommand } from '../src/main/tts/system'
import { createTestApp, tempDir } from './helpers/app'

const WAV_BYTES = Buffer.from(
  'RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x22\x56\x00\x00\x44\xac\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00',
)

const MAC_VOICES = `
Alex                en_US    # Most people recognize me by my voice.
Kyoko               ja_JP    # こんにちは! 私の名前はKyokoです。
Otoya               ja_JP    # こんにちは。僕の名前はオトヤです。
Flo                 en_US    # Hello, I am Flo.
Flo                 ja_JP    # こんにちは。
Eddy                ja_JP    # こんにちは。
`.trim()

const INJECTION_TEXT = 'こんにちは"; rm -rf /; powershell -Command "Get-ChildItem'

function createProvider(options: {
  platform: NodeJS.Platform
  runCommand: RunCommand
  tmpDir?: string
  cacheDir?: string
  timeoutMs?: number
}) {
  const root = tempDir('jla-system-tts-')
  return new SystemTTSProvider({
    platform: options.platform,
    cacheDir: options.cacheDir ?? path.join(root, 'cache'),
    tmpDir: options.tmpDir ?? path.join(root, 'tmp'),
    runCommand: options.runCommand,
    timeoutMs: options.timeoutMs,
  })
}

function macRunner(options?: {
  voices?: string
  sayExitCode?: number
  convertExitCode?: number
  sayStderr?: string
  convertStderr?: string
  hangMs?: number
}): { runCommand: RunCommand; calls: Array<{ command: string; args: string[] }> } {
  const calls: Array<{ command: string; args: string[] }> = []
  const runCommand: RunCommand = async (command, args) => {
    calls.push({ command, args: [...args] })
    if (command === '/usr/bin/say' && args[0] === '-v' && args[1] === '?') {
      return { stdout: options?.voices ?? MAC_VOICES, stderr: '', exitCode: 0 }
    }
    if (command === '/usr/bin/say') {
      if (options?.hangMs) {
        await new Promise((resolve) => setTimeout(resolve, options.hangMs))
      }
      const output = args[args.indexOf('-o') + 1]
      if (output) fs.writeFileSync(output, 'aiff')
      return {
        stdout: '',
        stderr: options?.sayStderr ?? '',
        exitCode: options?.sayExitCode ?? 0,
      }
    }
    if (command === '/usr/bin/afconvert') {
      const wav = args[args.length - 1]
      if ((options?.convertExitCode ?? 0) === 0 && wav) fs.writeFileSync(wav, WAV_BYTES)
      return {
        stdout: '',
        stderr: options?.convertStderr ?? '',
        exitCode: options?.convertExitCode ?? 0,
      }
    }
    throw new Error(`unexpected command ${command}`)
  }
  return { runCommand, calls }
}

describe('SystemTTSProvider macOS', () => {
  it('discovers ja_JP voices and prefers known female then male names', async () => {
    const { runCommand, calls } = macRunner()
    const provider = createProvider({ platform: 'darwin', runCommand })
    await provider.speak('こんにちは', { voiceGender: 'female' })
    const speakCall = calls.find(
      (call) => call.command === '/usr/bin/say' && call.args.includes('-o'),
    )
    expect(speakCall?.args).toEqual(['-v', 'Kyoko', '-o', expect.any(String), 'こんにちは'])

    const male = macRunner()
    await createProvider({ platform: 'darwin', runCommand: male.runCommand }).speak('こんにちは', {
      voiceGender: 'male',
    })
    const maleSpeak = male.calls.find(
      (call) => call.command === '/usr/bin/say' && call.args.includes('-o'),
    )
    expect(maleSpeak?.args[1]).toBe('Otoya')
  })

  it('falls back to any ja_JP voice when the requested gender is missing', async () => {
    const { runCommand, calls } = macRunner({
      voices:
        'Alex                en_US    # Hello.\nEddy                ja_JP    # こんにちは。\n',
    })
    await createProvider({ platform: 'darwin', runCommand }).speak('テスト', {
      voiceGender: 'female',
    })
    const speakCall = calls.find((call) => call.args.includes('-o'))
    expect(speakCall?.args[1]).toBe('Eddy')
  })

  it('runs say then afconvert with argv and writes cached WAV', async () => {
    const { runCommand, calls } = macRunner()
    const provider = createProvider({ platform: 'darwin', runCommand })
    const result = await provider.speak('こんにちは', { voiceGender: 'female', speed: 0.75 })
    expect(result.mimeType).toBe('audio/wav')
    expect(result.cached).toBe(false)
    expect(Buffer.from(result.bytes).equals(WAV_BYTES)).toBe(true)
    expect(calls[0]).toEqual({ command: '/usr/bin/say', args: ['-v', '?'] })
    expect(calls[1]?.command).toBe('/usr/bin/say')
    expect(calls[1]?.args[0]).toBe('-v')
    expect(calls[2]).toEqual({
      command: '/usr/bin/afconvert',
      args: ['-f', 'WAVE', '-d', 'LEI16@22050', expect.any(String), expect.any(String)],
    })
    expect(
      calls.every(
        (call) => call.command === '/usr/bin/say' || call.command === '/usr/bin/afconvert',
      ),
    ).toBe(true)
  })

  it('reuses cache for the same text and voice across playback speeds', async () => {
    const { runCommand, calls } = macRunner()
    const cacheDir = path.join(tempDir('jla-tts-cache-'), 'cache')
    const provider = createProvider({ platform: 'darwin', runCommand, cacheDir })
    const first = await provider.speak('こんにちは', { voiceGender: 'female', speed: 0.75 })
    const second = await provider.speak('こんにちは', { voiceGender: 'female', speed: 1 })
    expect(first.cached).toBe(false)
    expect(second.cached).toBe(true)
    expect(calls.filter((call) => call.args.includes('-o'))).toHaveLength(1)
    expect(calls.filter((call) => call.command === '/usr/bin/afconvert')).toHaveLength(1)
  })

  it('rejects empty text with a user-facing error', async () => {
    const { runCommand, calls } = macRunner()
    const provider = createProvider({ platform: 'darwin', runCommand })
    await expect(provider.speak('   ')).rejects.toMatchObject({
      name: 'ProviderError',
      message: '没有可朗读的文本',
      retryable: false,
    })
    expect(calls).toHaveLength(0)
  })

  it('reports a missing Japanese macOS voice without synthesizing', async () => {
    const { runCommand, calls } = macRunner({
      voices: 'Alex                en_US    # Hello.\nSamantha            en_US    # Hello.\n',
    })
    await expect(
      createProvider({ platform: 'darwin', runCommand }).speak('こんにちは'),
    ).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'configuration',
      retryable: false,
      message: '未找到 macOS 日语系统语音，请先在系统设置中下载日语语音后重试。',
    })
    expect(calls.some((call) => call.args.includes('-o'))).toBe(false)
  })

  it('passes hostile text as a single argv entry and never interpolates it into commands', async () => {
    const { runCommand, calls } = macRunner()
    await createProvider({ platform: 'darwin', runCommand }).speak(INJECTION_TEXT)
    const speakCall = calls.find((call) => call.args.includes('-o'))
    expect(speakCall?.args).toEqual(['-v', 'Kyoko', '-o', expect.any(String), INJECTION_TEXT])
    expect(
      calls.every(
        (call) => call.command === '/usr/bin/say' || call.command === '/usr/bin/afconvert',
      ),
    ).toBe(true)
  })

  it('maps command failure to a concise error without temp paths or command lines', async () => {
    const tmpDir = path.join(tempDir('jla-tts-fail-'), 'tmp')
    fs.mkdirSync(tmpDir, { recursive: true })
    const { runCommand } = macRunner({
      sayExitCode: 1,
      sayStderr: `say: failed writing ${tmpDir}/secret.aiff`,
    })
    await expect(
      createProvider({ platform: 'darwin', runCommand, tmpDir }).speak('こんにちは'),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ProviderError)
      const message = (error as Error).message
      expect(message).toBe('系统语音生成失败，请确认已安装日语语音后重试。')
      expect(message).not.toContain(tmpDir)
      expect(message).not.toContain('/usr/bin/say')
      expect(message).not.toContain('secret.aiff')
      return true
    })
    expect(fs.readdirSync(tmpDir)).toEqual([])
  })
})

describe('SystemTTSProvider Windows', () => {
  it('invokes powershell.exe -File with a generated script and UTF-8 text file', async () => {
    const tmpDir = path.join(tempDir('jla-tts-win-'), 'tmp')
    fs.mkdirSync(tmpDir, { recursive: true })
    let script = ''
    let textContents = ''
    const runCommand: RunCommand = async (command, args) => {
      expect(command).toBe('powershell.exe')
      expect(args.slice(0, 5)).toEqual([
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
      ])
      expect(args).toHaveLength(6)
      expect(args.includes('cmd.exe')).toBe(false)
      const scriptPath = args[5]!
      script = fs.readFileSync(scriptPath, 'utf8')
      const textPath = [...script.matchAll(/'([^']+)'/g)]
        .map((match) => match[1])
        .find((value) => value.endsWith('.txt'))
      expect(textPath).toBeTruthy()
      textContents = fs.readFileSync(textPath!, 'utf8')
      const wavPath = [...script.matchAll(/'([^']+)'/g)]
        .map((match) => match[1])
        .find((value) => value.endsWith('.wav'))
      fs.writeFileSync(wavPath!, WAV_BYTES)
      return { stdout: '', stderr: '', exitCode: 0 }
    }

    const result = await createProvider({
      platform: 'win32',
      runCommand,
      tmpDir,
    }).speak(INJECTION_TEXT, { voiceGender: 'female' })

    expect(result.mimeType).toBe('audio/wav')
    expect(result.cached).toBe(false)
    expect(textContents).toBe(INJECTION_TEXT)
    expect(script).not.toContain(INJECTION_TEXT)
    expect(script).toContain('System.Speech.Synthesis.SpeechSynthesizer')
    expect(script).toContain('[System.Speech.Synthesis.VoiceGender]::Female')
    expect(script).toMatch(/Culture\.Name\.StartsWith\('ja'\)/)
    expect(script).toMatch(/Select-Object -First 1/)
    expect(fs.readdirSync(tmpDir)).toEqual([])
  })

  it('embeds male VoiceGender and still falls back to any Japanese voice in the script', async () => {
    let script = ''
    const runCommand: RunCommand = async (_command, args) => {
      script = fs.readFileSync(args[5]!, 'utf8')
      const wavPath = [...script.matchAll(/'([^']+)'/g)]
        .map((match) => match[1])
        .find((value) => value.endsWith('.wav'))
      fs.writeFileSync(wavPath!, WAV_BYTES)
      return { stdout: '', stderr: '', exitCode: 0 }
    }
    await createProvider({ platform: 'win32', runCommand }).speak('テスト', { voiceGender: 'male' })
    expect(script).toContain('[System.Speech.Synthesis.VoiceGender]::Male')
    expect(script).toContain('JLA_TTS_NO_JA_VOICE')
  })

  it('maps missing Japanese Windows voices to the install message', async () => {
    const runCommand: RunCommand = async (_command, args) => {
      const script = fs.readFileSync(args[5]!, 'utf8')
      const wavPath = [...script.matchAll(/'([^']+)'/g)]
        .map((match) => match[1])
        .find((value) => value.endsWith('.wav'))
      if (wavPath) fs.writeFileSync(wavPath, '')
      return { stdout: '', stderr: 'JLA_TTS_NO_JA_VOICE', exitCode: 2 }
    }
    await expect(
      createProvider({ platform: 'win32', runCommand }).speak('こんにちは'),
    ).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'configuration',
      retryable: false,
      message: '未找到 Windows 日语系统语音，请先在 Windows 语言设置中安装日语语音包后重试。',
    })
  })
})

describe('SystemTTSProvider platform and timeout', () => {
  it('rejects unsupported platforms without spawning', async () => {
    const calls: unknown[] = []
    const runCommand: RunCommand = async (command, args) => {
      calls.push({ command, args })
      return { stdout: '', stderr: '', exitCode: 0 }
    }
    await expect(
      createProvider({ platform: 'linux', runCommand }).speak('こんにちは'),
    ).rejects.toMatchObject({
      name: 'ProviderError',
      code: 'configuration',
      retryable: false,
      message: '系统语音发音目前仅支持 Windows 和 macOS。',
    })
    expect(calls).toHaveLength(0)
  })

  it('times out, kills the child, and cleans request temp files', async () => {
    const tmpDir = path.join(tempDir('jla-tts-timeout-'), 'tmp')
    fs.mkdirSync(tmpDir, { recursive: true })
    const { runCommand } = macRunner({ hangMs: 400 })
    await expect(
      createProvider({
        platform: 'darwin',
        runCommand,
        tmpDir,
        timeoutMs: 40,
      }).speak('こんにちは'),
    ).rejects.toMatchObject({
      message: '语音生成超时，请重试。',
    })
    expect(fs.readdirSync(tmpDir)).toEqual([])
  })

  it('default runner kills only the spawned child after timeout', async () => {
    const started = Date.now()
    await expect(
      runTimedCommand(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { timeoutMs: 80 }),
    ).rejects.toMatchObject({ message: '语音生成超时，请重试。' })
    expect(Date.now() - started).toBeLessThan(5000)
  })
})

describe('AppServices system TTS integration', () => {
  it('defaults to SystemTTSProvider and honors ttsProvider overrides', async () => {
    const app = createTestApp()
    expect(await app.createTTSProvider()).toBeInstanceOf(SystemTTSProvider)
    app.close()

    const override = {
      speak: async () => ({
        mimeType: 'audio/wav' as const,
        bytes: new Uint8Array([1, 2, 3]),
        cached: true,
      }),
    }
    const withOverride = createTestApp({ ttsProvider: override })
    expect(await withOverride.createTTSProvider()).toBe(override)
    const spoken = await withOverride.speak({ text: 'こんにちは', speed: 1 })
    expect(spoken.mimeType).toBe('audio/wav')
    expect(spoken.cached).toBe(true)
    withOverride.close()
  })

  it('does not register Kokoro install IPC channels', () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>()
    const ipcMain = {
      handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
        handlers.set(channel, listener)
      },
    }
    registerIpc(ipcMain as unknown as IpcMain, { speak: vi.fn() } as unknown as AppServices)
    expect(handlers.has(IPC_CHANNELS.ttsSpeak)).toBe(true)
    expect(handlers.has('tts:install')).toBe(false)
    expect(handlers.has('tts:installStatus')).toBe(false)
    expect(handlers.has('tts:installCancel')).toBe(false)
    expect(handlers.has('tts:installProgress')).toBe(false)
  })
})
