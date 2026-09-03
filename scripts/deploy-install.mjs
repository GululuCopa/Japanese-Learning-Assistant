import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  HELP_TEXT,
  PROJECT_NAME,
  QUALITY_GATES,
  RECOMMENDED_NODE_MAJOR,
  assertMacInstallTarget,
  evaluateNodeVersion,
  isSupportedPlatform,
  nodeTooOldMessage,
  npmExecutable,
  parseArgs,
  selectMacApp,
  selectWindowsInstaller,
  unsupportedPlatformMessage,
} from './deploy-install-policy.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function main(argv = process.argv.slice(2), runtime = defaultRuntime()) {
  let parsed
  try {
    parsed = parseArgs(argv)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }

  if (parsed.help) {
    runtime.log(HELP_TEXT)
    return 0
  }

  const env = inspectEnvironment(runtime)
  runtime.log(`操作系统：${env.platform} ${env.arch}`)
  runtime.log(`Node.js：${env.nodeVersion}`)
  runtime.log(`npm：${env.npmVersion}`)
  runtime.log(`项目目录：${env.root}`)
  if (env.nodeWarning) {
    runtime.warn(`警告：${env.nodeWarning}`)
  }
  runtime.log('环境检查通过。')

  if (parsed.checkOnly) {
    runtime.log('已选择 --check-only：未安装依赖，未构建，未安装应用。')
    return 0
  }

  runNpm(runtime, env, ['ci'], '安装锁定依赖 (npm ci)')
  if (parsed.skipChecks) {
    runtime.warn('警告：已跳过 format/lint/typecheck/test。产物可能未通过质量门禁。')
  } else {
    for (const gate of QUALITY_GATES) {
      runNpm(runtime, env, gate.args, gate.title)
    }
  }

  if (env.platform === 'win32') {
    runNpm(runtime, env, ['run', 'package:win'], '打包 Windows x64 安装包')
    const installer = resolveWindowsInstaller(runtime)
    if (parsed.packageOnly) {
      runtime.log(`已选择 --package-only：安装包位于 ${installer}`)
      return 0
    }
    runtime.log(`启动安装程序并等待完成：${installer}`)
    runCommand(runtime, installer, [], path.dirname(installer), '运行 Windows 安装程序')
    return 0
  }

  runNpm(runtime, env, ['run', 'package:dir'], '打包 macOS arm64 应用')
  const appBundle = selectMacApp(env.root, (candidate) => isDirectory(runtime, candidate))
  if (parsed.packageOnly) {
    runtime.log(`已选择 --package-only：应用包位于 ${appBundle}`)
    return 0
  }
  const target = assertMacInstallTarget(
    runtime.homedir(),
    runtime.path.join(runtime.homedir(), 'Applications', path.basename(appBundle)),
  )
  installMacApp(runtime, appBundle, target)
  runtime.log(`启动应用：${target}`)
  runCommand(runtime, 'open', [target], env.root, '打开 macOS 应用')
  return 0
}

function inspectEnvironment(runtime) {
  const platform = runtime.platform()
  const arch = runtime.arch()
  if (!isSupportedPlatform(platform, arch)) {
    fail(unsupportedPlatformMessage(platform, arch))
  }

  const pkgPath = runtime.path.join(root, 'package.json')
  let pkg
  try {
    pkg = JSON.parse(runtime.readFile(pkgPath))
  } catch {
    fail('无法读取项目根目录的 package.json。请在仓库根目录运行安装脚本。')
  }
  if (pkg.name !== PROJECT_NAME) {
    fail(`项目名称不匹配：期望 ${PROJECT_NAME}，实际 ${pkg.name ?? '未知'}。`)
  }

  const nodeVersion = runtime.nodeVersion()
  const node = evaluateNodeVersion(nodeVersion)
  if (!node.ok) {
    fail(nodeTooOldMessage(node.major))
  }

  const npm = npmExecutable(platform)
  const npmProbe = runtime.spawn(npm, ['--version'], { cwd: root, encoding: 'utf8' })
  if (npmProbe.error?.code === 'ENOENT' || npmProbe.status !== 0) {
    fail(
      `未找到可用的 npm（期望命令 ${npm}）。请先安装 Node.js ${RECOMMENDED_NODE_MAJOR} 自带的 npm。`,
    )
  }

  return {
    platform,
    arch,
    root,
    npm,
    nodeVersion,
    npmVersion: String(npmProbe.stdout ?? '').trim(),
    nodeWarning: node.warning,
  }
}

function runNpm(runtime, env, args, title) {
  runCommand(runtime, env.npm, args, env.root, title, {
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  })
}

function runCommand(runtime, command, args, cwd, title, extraEnv = {}) {
  runtime.log(`==> ${title}`)
  runtime.log(`$ ${command} ${args.join(' ')}`.trim())
  const result = runtime.spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...runtime.env(), ...extraEnv },
  })
  if (result.error?.code === 'ENOENT') {
    fail(`未找到命令：${command}。${nextStepHint(command, args)}`)
  }
  if (result.status !== 0) {
    fail(
      `命令失败：${command} ${args.join(' ')}（退出码 ${result.status ?? 1}）。${nextStepHint(command, args)}`,
    )
  }
}

function nextStepHint(command, args) {
  const joined = `${command} ${args.join(' ')}`
  if (joined.includes('ci')) {
    return '下一步：检查网络和 npm registry 后重试。'
  }
  if (joined.includes('package')) {
    return '下一步：查看打包日志；Windows 安装包请在 Windows x64 上构建。'
  }
  return '下一步：查看上方日志，修复问题后重新运行安装脚本。'
}

function resolveWindowsInstaller(runtime) {
  const releaseDir = runtime.path.join(root, 'release')
  let names
  try {
    names = runtime.readdir(releaseDir)
  } catch {
    fail('未找到 release 目录。请先完成打包。')
  }
  let installer
  try {
    installer = selectWindowsInstaller(releaseDir, names, runtime.path)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
  if (!isFile(runtime, installer)) {
    fail('找到的 Windows 安装包不是普通文件，已取消启动。')
  }
  return installer
}

function installMacApp(runtime, source, target) {
  runtime.log(`安装到用户目录：${target}`)
  if (runtime.exists(target)) {
    runtime.rm(target)
  }
  runtime.mkdir(runtime.path.dirname(target))
  runtime.copy(source, target)
}

function isDirectory(runtime, candidate) {
  try {
    return runtime.stat(candidate).isDirectory()
  } catch {
    return false
  }
}

function isFile(runtime, candidate) {
  try {
    return runtime.stat(candidate).isFile()
  } catch {
    return false
  }
}

function fail(message) {
  throw new InstallError(message)
}

class InstallError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InstallError'
  }
}

function defaultRuntime() {
  return {
    platform: () => process.platform,
    arch: () => process.arch,
    nodeVersion: () => process.version,
    homedir: () => os.homedir(),
    env: () => process.env,
    path,
    log: (message) => console.log(message),
    warn: (message) => console.warn(message),
    readFile: (filePath) => fs.readFileSync(filePath, 'utf8'),
    readdir: (dir) => fs.readdirSync(dir),
    exists: (filePath) => fs.existsSync(filePath),
    stat: (filePath) => fs.statSync(filePath),
    rm: (filePath) => fs.rmSync(filePath, { recursive: true, force: true }),
    mkdir: (dir) => fs.mkdirSync(dir, { recursive: true }),
    copy: (from, to) => fs.cpSync(from, to, { recursive: true }),
    spawn: (command, args, options) => spawnSync(command, args, options),
  }
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return pathToFileURL(path.resolve(entry)).href === import.meta.url
  } catch {
    return false
  }
}

if (isDirectRun()) {
  try {
    const code = main()
    process.exit(code ?? 0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  }
}
