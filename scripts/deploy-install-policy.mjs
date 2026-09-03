import path from 'node:path'

export const PROJECT_NAME = 'japanese-learning-assistant'
export const APP_PRODUCT_NAME = 'Japanese Learning Assistant'
export const MAC_APP_BUNDLE = 'Japanese Learning Assistant.app'
export const RECOMMENDED_NODE_MAJOR = 22

export const QUALITY_GATES = [
  { title: '格式检查', args: ['run', 'format'] },
  { title: 'Lint', args: ['run', 'lint'] },
  { title: '类型检查', args: ['run', 'typecheck'] },
  { title: '测试', args: ['test', '--', '--run'] },
]

export const HELP_TEXT = `Japanese Learning Assistant 一键环境检查与安装

用法：
  install-windows.cmd [选项]
  ./install-macos.command [选项]

选项：
  --help           显示本说明并退出
  --check-only     只检查环境、仓库和 npm，不安装依赖、不构建、不安装应用
  --skip-checks    仍执行 npm ci 与打包，但跳过 format/lint/typecheck/test
  --package-only   完成依赖、门禁和打包，但不安装或启动应用

默认流程：环境检查 → npm ci → 质量门禁 → 打包当前平台 → 安装并启动。

说明：
  - 必须在已下载的项目根目录运行，不会克隆 Git 仓库。
  - npm ci 会按 package-lock.json 重建 node_modules。
  - 不会安装 Node.js、Git、系统日语语音或任何 API Key。
  - 仅支持 Windows 10/11 x64 与 macOS arm64。
  - 当前应用未签名；Windows SmartScreen 或 macOS Gatekeeper 可能提示风险。
`

export function parseArgs(argv) {
  const result = {
    help: false,
    checkOnly: false,
    skipChecks: false,
    packageOnly: false,
  }
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true
      continue
    }
    if (arg === '--check-only') {
      result.checkOnly = true
      continue
    }
    if (arg === '--skip-checks') {
      result.skipChecks = true
      continue
    }
    if (arg === '--package-only') {
      result.packageOnly = true
      continue
    }
    throw new Error(`未知参数：${arg}`)
  }
  if (result.checkOnly && (result.packageOnly || result.skipChecks)) {
    throw new Error('参数冲突：--check-only 不能与 --package-only 或 --skip-checks 同时使用。')
  }
  return result
}

export function evaluateNodeVersion(version) {
  const major = Number.parseInt(String(version).replace(/^v/, '').split('.')[0], 10)
  if (!Number.isInteger(major) || major < RECOMMENDED_NODE_MAJOR) {
    return { ok: false, major }
  }
  if (major > RECOMMENDED_NODE_MAJOR) {
    return {
      ok: true,
      major,
      warning: `当前 Node.js 为 ${major}，推荐使用 Node.js ${RECOMMENDED_NODE_MAJOR}。更高版本未经 CI 固定验证。`,
    }
  }
  return { ok: true, major: RECOMMENDED_NODE_MAJOR }
}

export function isSupportedPlatform(platform, arch) {
  return (platform === 'win32' && arch === 'x64') || (platform === 'darwin' && arch === 'arm64')
}

export function npmExecutable(platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm'
}

export function selectWindowsInstaller(releaseDir, names, pathApi = path) {
  const matches = names.filter(
    (name) =>
      typeof name === 'string' &&
      !name.includes('/') &&
      !name.includes('\\') &&
      /setup-x64\.exe$/i.test(name),
  )
  if (matches.length !== 1) {
    throw new Error(
      '未找到唯一的 Windows x64 NSIS 安装包（release/*-setup-x64.exe）。请先完成打包或检查 release 目录。',
    )
  }
  return pathApi.join(releaseDir, matches[0])
}

export function selectMacApp(projectRoot, exists, pathApi = path) {
  const abs = pathApi.join(projectRoot, 'release', 'mac-arm64', MAC_APP_BUNDLE)
  if (!exists(abs)) {
    throw new Error(`未找到 macOS arm64 应用包 release/mac-arm64/${MAC_APP_BUNDLE}。请先完成打包。`)
  }
  return abs
}

export function macInstallTarget(homeDir, pathApi = path) {
  if (!homeDir || typeof homeDir !== 'string' || !homeDir.trim()) {
    throw new Error('无法确定用户主目录，已取消安装。')
  }
  return pathApi.resolve(homeDir, 'Applications', MAC_APP_BUNDLE)
}

export function assertMacInstallTarget(homeDir, target, pathApi = path) {
  const expected = macInstallTarget(homeDir, pathApi)
  const resolvedTarget = pathApi.resolve(target)
  const applications = pathApi.resolve(homeDir, 'Applications')
  if (resolvedTarget !== expected) {
    throw new Error(`macOS 安装目标必须是用户 Applications 目录下的 ${MAC_APP_BUNDLE}。`)
  }
  if (!isPathInside(applications, expected, pathApi)) {
    throw new Error('macOS 安装目标必须位于用户 Applications 目录内。')
  }
  return expected
}

export function isPathInside(root, target, pathApi = path) {
  const resolvedRoot = pathApi.resolve(root)
  const resolvedTarget = pathApi.resolve(target)
  const relative = pathApi.relative(resolvedRoot, resolvedTarget)
  return relative !== '' && !relative.startsWith('..') && !pathApi.isAbsolute(relative)
}

export function unsupportedPlatformMessage(platform, arch) {
  return `当前系统不受支持（${platform}/${arch}）。仅支持 Windows 10/11 x64 与 macOS arm64。`
}

export function nodeTooOldMessage(major) {
  return `Node.js 版本过低（当前 ${major ?? '未知'}）。需要 Node.js ${RECOMMENDED_NODE_MAJOR} 或更高版本。`
}
