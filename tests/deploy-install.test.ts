import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assertMacInstallTarget,
  evaluateNodeVersion,
  isSupportedPlatform,
  npmExecutable,
  parseArgs,
  selectMacApp,
  selectWindowsInstaller,
} from '../scripts/deploy-install-policy.mjs'

const root = process.cwd()
const macPath = path.posix

describe('deploy install argument parsing', () => {
  it('parses supported flags and treats help as success', () => {
    expect(parseArgs([])).toEqual({
      help: false,
      checkOnly: false,
      skipChecks: false,
      packageOnly: false,
    })
    expect(parseArgs(['--help'])).toMatchObject({ help: true })
    expect(parseArgs(['-h'])).toMatchObject({ help: true })
    expect(parseArgs(['--check-only'])).toMatchObject({ checkOnly: true })
    expect(parseArgs(['--skip-checks'])).toMatchObject({ skipChecks: true })
    expect(parseArgs(['--package-only'])).toMatchObject({ packageOnly: true })
    expect(parseArgs(['--skip-checks', '--package-only'])).toMatchObject({
      skipChecks: true,
      packageOnly: true,
    })
  })

  it('rejects unknown and conflicting arguments', () => {
    expect(() => parseArgs(['--deploy'])).toThrow(/未知参数/)
    expect(() => parseArgs(['--check-only', '--package-only'])).toThrow(/冲突/)
    expect(() => parseArgs(['--check-only', '--skip-checks'])).toThrow(/冲突/)
  })
})

describe('deploy install environment policy', () => {
  it('requires Node major 22 and warns above 22', () => {
    expect(evaluateNodeVersion('22.14.1')).toEqual({ ok: true, major: 22 })
    expect(evaluateNodeVersion('v22.0.0')).toEqual({ ok: true, major: 22 })
    expect(evaluateNodeVersion('24.12.0')).toMatchObject({
      ok: true,
      major: 24,
      warning: expect.stringMatching(/未经 CI 固定验证/),
    })
    expect(evaluateNodeVersion('20.19.0')).toMatchObject({ ok: false, major: 20 })
    expect(evaluateNodeVersion('21.7.3')).toMatchObject({ ok: false, major: 21 })
  })

  it('supports only Windows x64 and macOS arm64', () => {
    expect(isSupportedPlatform('win32', 'x64')).toBe(true)
    expect(isSupportedPlatform('darwin', 'arm64')).toBe(true)
    expect(isSupportedPlatform('darwin', 'x64')).toBe(false)
    expect(isSupportedPlatform('win32', 'arm64')).toBe(false)
    expect(isSupportedPlatform('linux', 'x64')).toBe(false)
  })

  it('selects the platform npm executable', () => {
    expect(npmExecutable('win32')).toBe('npm.cmd')
    expect(npmExecutable('darwin')).toBe('npm')
    expect(npmExecutable('linux')).toBe('npm')
  })
})

describe('deploy install artifacts and macOS target', () => {
  it('selects the unique Windows x64 NSIS setup from release/', () => {
    expect(
      selectWindowsInstaller('C:\\proj\\release', [
        'Japanese Learning Assistant-0.1.0-setup-x64.exe',
        'Japanese Learning Assistant-0.1.0-win-x64.exe',
        'Japanese Learning Assistant-0.1.0-setup-x64.exe.blockmap',
        'win-unpacked',
      ]),
    ).toBe(path.join('C:\\proj\\release', 'Japanese Learning Assistant-0.1.0-setup-x64.exe'))
    expect(() =>
      selectWindowsInstaller('/proj/release', ['Japanese Learning Assistant-0.1.0-win-x64.exe']),
    ).toThrow(/唯一的 Windows x64 NSIS/)
    expect(() =>
      selectWindowsInstaller('/proj/release', [
        'Japanese Learning Assistant-0.1.0-setup-x64.exe',
        'other-setup-x64.exe',
      ]),
    ).toThrow(/唯一的 Windows x64 NSIS/)
  })

  it('accepts only the exact macOS arm64 app bundle', () => {
    const project = '/Users/dev/japan-listener'
    expect(
      selectMacApp(
        project,
        (candidate: string) =>
          candidate.endsWith(
            `${macPath.sep}release${macPath.sep}mac-arm64${macPath.sep}Japanese Learning Assistant.app`,
          ),
        macPath,
      ),
    ).toBe(macPath.join(project, 'release', 'mac-arm64', 'Japanese Learning Assistant.app'))
    expect(() => selectMacApp(project, () => false, macPath)).toThrow(/macOS arm64/)
  })

  it('restricts macOS install replacement to $HOME/Applications/<exact app>', () => {
    const home = '/Users/demo'
    const expected = macPath.join(home, 'Applications', 'Japanese Learning Assistant.app')
    expect(assertMacInstallTarget(home, expected, macPath)).toBe(expected)
    expect(() => assertMacInstallTarget(home, macPath.join(home, 'Applications'), macPath)).toThrow(
      /Applications/,
    )
    expect(() =>
      assertMacInstallTarget(
        home,
        macPath.join(home, 'Desktop', 'Japanese Learning Assistant.app'),
        macPath,
      ),
    ).toThrow()
    expect(() =>
      assertMacInstallTarget(home, macPath.join(home, 'Applications', '..', 'Secret.app'), macPath),
    ).toThrow()
    expect(() => assertMacInstallTarget('', expected, macPath)).toThrow()
  })
})

describe('deploy install wrappers and npm scripts', () => {
  it('wires root entrypoints to the shared Node orchestrator', () => {
    const cmd = fs.readFileSync(path.join(root, 'install-windows.cmd'), 'utf8')
    const ps1 = fs.readFileSync(path.join(root, 'scripts', 'install.ps1'), 'utf8')
    const commandFile = fs.readFileSync(path.join(root, 'install-macos.command'), 'utf8')
    const sh = fs.readFileSync(path.join(root, 'scripts', 'install.sh'), 'utf8')
    const orchestrator = fs.readFileSync(path.join(root, 'scripts', 'deploy-install.mjs'), 'utf8')

    expect(cmd).toMatch(/powershell\.exe/i)
    expect(cmd).toMatch(/-NoProfile/)
    expect(cmd).toMatch(/-ExecutionPolicy Bypass/)
    expect(cmd).toMatch(/scripts\\install\.ps1/)
    expect(ps1).toMatch(/deploy-install\.mjs/)
    expect(ps1).not.toMatch(/sudo|Start-Process.*-Verb RunAs|irm .* \|/i)
    expect(commandFile).toMatch(/scripts\/install\.sh/)
    expect(sh).toMatch(/deploy-install\.mjs/)
    expect(sh).not.toMatch(/\bsudo\b|xattr -cr|curl .*\|/)
    expect(orchestrator).toMatch(/deploy-install-policy/)
    expect(orchestrator).not.toMatch(/\bsudo\b|spctl --master-disable|xattr -cr/)
  })

  it('keeps package scripts compatible with the installer flow', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      name: string
      scripts: Record<string, string>
    }
    expect(pkg.name).toBe('japanese-learning-assistant')
    expect(pkg.scripts['package:dir']).toContain('electron-builder --dir')
    expect(pkg.scripts['package:win']).toContain('electron-builder --win nsis dir --x64')
  })
})
