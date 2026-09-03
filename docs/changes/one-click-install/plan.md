# One-click environment check and desktop installation

**Status:** READY_FOR_EXECUTION
**Mode:** IMPLEMENT
**Master:** Codex
**Executor:** right-side Herdr Grok 4.6 xhigh
**Date:** 2026-09-03
**Baseline:** `314c83e0cd2ee0a7d2bdd92107b1e278ae3e50a1`

## Objective

为源码仓库增加可直接运行的环境检查与一键部署安装入口，覆盖项目正式支持的 Windows 10/11 x64 和 macOS arm64。默认流程应检查环境、安装锁定依赖、执行质量门禁、打包当前平台应用，并安装/启动生成的应用；同时提供只检查和只打包模式。README 必须明确普通用户如何运行、脚本会做什么、不会做什么及失败后的处理。

## Non-goals

- 不自动安装或升级 Node.js、npm、Git、系统日语语音、AI/TTS Key。
- 不下载 Git 仓库；脚本在已 clone/download 的项目根目录内运行。
- 不支持 Linux 安装、macOS x64 或 Windows ARM64。
- 不修改应用业务逻辑、数据库 schema、TTS/AI provider、签名/公证配置或发布 workflow。
- 不静默跳过测试或覆盖项目外任意目录。
- 不提交 `release/`、`out/`、本地用户数据、`.DS_Store` 或 `.omx/`。

## Current behavior and evidence

- README 当前要求用户手动执行 `npm ci`、`npm run dev`，发布章节要求手动执行 `npm run package:win` / `npm run package:dir`。
- `electron-builder.yml` 支持 Windows x64 NSIS + dir；macOS 只配置 arm64 dir，未签名。
- Windows installer 输出到 `release/*-setup-x64.exe`；macOS app 输出到 `release/mac-arm64/Japanese Learning Assistant.app`。
- 当前环境验证表明 Node 24 也能通过 format/lint/typecheck/test/build；因此脚本要求 Node major >= 22，并在不是推荐的 Node 22 时给出 warning 而不是拒绝。
- 现有 `scripts/ensure-sqlite-abi.mjs` 会在 test/dev 生命周期处理 better-sqlite3 ABI。
- 当前工作树在新增本计划前干净；只存在本计划的未跟踪目录。

## Approved design

### Entry points

提供用户可见的一键入口：

- Windows：根目录 `install-windows.cmd`，双击或从 CMD/PowerShell 执行；它以 `-NoProfile -ExecutionPolicy Bypass` 调用 `scripts/install.ps1` 并透传参数。
- macOS：根目录 `install-macos.command`，保持 executable bit，可双击或在终端执行；它调用 `scripts/install.sh` 并透传参数。
- `scripts/install.ps1` / `scripts/install.sh` 只负责定位仓库、确认 Node 命令存在并调用共享 Node orchestrator。
- `scripts/deploy-install.mjs` 是唯一流程实现，避免 Windows/macOS 行为漂移，并导出可单测的纯函数。

### Supported modes

共享参数在两个平台一致：

- default：环境检查 → `npm ci` → quality gates → package → install/launch。
- `--check-only`：只做环境、仓库和 npm 可用性检查，不修改依赖、不构建、不安装。
- `--skip-checks`：仍运行 `npm ci` 和打包，但跳过 format/lint/typecheck/test；输出醒目 warning。
- `--package-only`：完成依赖、门禁和打包，但不安装/启动产物。
- `--help`：显示中文说明并成功退出。
- 未知参数、互相冲突参数或命令失败必须非零退出；`--check-only` 与 `--package-only` / `--skip-checks` 视为冲突，避免含糊行为。

### Environment checks

- 必须从脚本自身位置解析项目根，不依赖调用者当前目录。
- 验证 `package.json` 的项目名为 `japanese-learning-assistant`。
- 支持组合仅为 `win32/x64` 与 `darwin/arm64`；其他平台给出明确错误。
- Node major 必须 >= 22。Node 22 是推荐版本；更高 major 输出“未经 CI 固定验证”的 warning 后继续。
- 验证 npm 可调用，并打印 OS、架构、Node、npm、项目目录。
- 不预判网络；`npm ci` 的真实失败作为联网/registry 权威反馈。

### Build and install behavior

Quality gates order: `npm run format`, `npm run lint`, `npm run typecheck`, `npm test -- --run`.

- Windows：运行 `npm run package:win`；通过精确后缀/文件类型从 `release/` 找到唯一 NSIS x64 setup。默认直接启动并等待 installer，退出码向上传播；`--package-only` 只打印产物路径。
- macOS：运行 `npm run package:dir`；只接受 `release/mac-arm64/Japanese Learning Assistant.app`。默认安装到用户目录 `$HOME/Applications/Japanese Learning Assistant.app`，不请求 sudo。替换前只允许删除这个经过规范化并验证位于 `$HOME/Applications` 下的精确目标 bundle；复制后用 `open` 启动。`--package-only` 不触碰 `$HOME/Applications`。
- 每一步打印带编号或清晰标题的日志；失败时输出失败命令和下一步建议。
- 不处理签名、Gatekeeper 绕过或系统安全设置。

### Tests

新增 `scripts/deploy-install-policy.mjs`（如 executor 认为把纯函数直接放在 orchestrator 更清晰也可）以便测试：

- 参数解析和冲突。
- Node version >=22 与 >22 warning。
- 支持平台/架构矩阵。
- npm executable (`npm.cmd` on Windows, `npm` elsewhere)。
- Windows installer artifact 和 macOS app artifact 的安全、唯一选择。
- macOS install target containment validation。
- package.json npm scripts或 wrapper wiring 的静态合同。

不要在自动化测试中真的运行 `npm ci`、installer、`open` 或删除 `$HOME/Applications`。

## Expected files

- `install-windows.cmd` (new)
- `install-macos.command` (new, executable)
- `scripts/install.ps1` (new)
- `scripts/install.sh` (new, executable)
- `scripts/deploy-install.mjs` (new)
- `scripts/deploy-install-policy.mjs` (optional new if used for pure logic)
- `tests/deploy-install.test.ts` (new)
- `package.json` only if adding documented npm aliases materially improves use; not required
- `README.md`
- `docs/changes/one-click-install/execution.md`
- `docs/changes/one-click-install/review.md` may be written by MASTER after review, not required from executor

No production source or workflow changes are approved.

## Implementation steps

1. Read this packet and repository instructions; verify baseline and dirty state. Stop on scope/design conflict.
2. Implement the shared pure policy and tests first; demonstrate relevant red/green evidence where feasible.
3. Implement Node orchestrator and thin Windows/macOS wrappers.
4. Update README with one-click quick start, modes, prerequisites, output/install paths, Windows execution-policy behavior, unsigned app warnings, and manual commands retained for developers.
5. Run focused tests and syntax checks (`bash -n` for shell files; PowerShell parse only if `pwsh`/PowerShell exists, otherwise document unverified).
6. Run `--help` and `--check-only` from a directory outside the repo to prove path independence; current host Node 24 should warn and continue.
7. Run full verification and write execution evidence.

## Acceptance criteria

- Windows and macOS root entrypoints are obvious and pass arguments to the same orchestrator.
- `--check-only` runs successfully on current macOS arm64/Node 24, prints warning and does not modify/build/install.
- Default flow is fail-fast and performs deterministic `npm ci`, quality gates, platform package and install/launch.
- `--package-only` cannot install/launch or delete an installed app.
- macOS deletion/copy target is restricted to the exact user Applications bundle; Windows selects one exact x64 NSIS setup artifact.
- Unsupported OS/arch and Node <22 fail with actionable Chinese messages.
- Scripts contain no credentials, no sudo/elevation, no remote shell execution, no Gatekeeper bypass and no arbitrary deletion.
- README accurately describes behavior and limitations.
- Existing 27 files / 103 tests remain green, plus new tests.
- Full local macOS package directory build succeeds; Windows behavior is covered by pure tests and must remain compatible with Windows CI/package command.

## Verification commands

```bash
npm test -- --run tests/deploy-install.test.ts
bash -n scripts/install.sh install-macos.command
./install-macos.command --help
(cd /tmp && /Users/renxiaowen/Desktop/japan-listener/install-macos.command --check-only)
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run package:dir
git diff --check
git status --short
```

If `pwsh` exists:

```bash
pwsh -NoProfile -Command '$errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path "scripts/install.ps1"), [ref]$null, [ref]$errors); if ($errors.Count) { $errors | Out-String | Write-Error; exit 1 }'
```

## Compatibility and rollback

- Scripts are additive and do not change runtime data/schema.
- `npm ci` intentionally recreates `node_modules` from `package-lock.json`; README must state this.
- macOS default install replaces only the exact app bundle in `$HOME/Applications`; app `userData` is elsewhere and preserved.
- Rollback removes the new entrypoints/scripts/tests/docs and restores README.

## Unresolved questions

None blocking under the default design. Automatic installation of Node/package managers and signed distribution are separate future features.
