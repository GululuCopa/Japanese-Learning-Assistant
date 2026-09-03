# Windows CI macOS path-policy test fix

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Master:** Codex
**Executor:** Herdr OpenCode — DeepSeek V4 Pro
**Date:** 2026-09-03
**Baseline:** `f813f55d02e5d1e6a1c42993c88849aa31a33721`

## Objective

修复 GitHub Actions Windows run `33767876921` 中 `tests/deploy-install.test.ts:106` 的跨平台测试失败。测试验证的是 macOS 安装目标策略，却使用当前 runner 默认 `path` 处理虚拟 POSIX 路径 `/Users/demo`；在 Windows 上 `path.join` 与 `path.resolve` 对该输入产生不同结果，导致断言失败。让测试显式使用 `path.posix`，继续验证 macOS 路径策略且不改变生产逻辑。

## Non-goals

- 不修改 `scripts/deploy-install-policy.mjs`、安装脚本、README、workflow 或生产源码。
- 不改变 macOS 安装目标安全策略。
- 不改变 Windows 安装流程。
- 不修改 `docs/PRD.md`、`.DS_Store`、`.omx/` 或 release 产物。

## Current evidence

GitHub Actions run `33767876921`, commit `f813f55d`, Windows job `100693170240`：

- Install dependencies、Lint、Typecheck 通过。
- Test 在 `tests/deploy-install.test.ts > deploy install artifacts and macOS target > restricts macOS install replacement to $HOME/Applications/<exact app>` 失败。
- 失败行 106：期望 `\\Users\\demo\\Applications\\Japanese Learning Assistant.app`，实际 `D:\\Users\\demo\\Applications\\Japanese Learning Assistant.app`。
- 失败原因是测试数据是 POSIX macOS 路径，测试却使用了 Windows runner 的默认 `node:path`。

## Approved design

在 `tests/deploy-install.test.ts` 中为 macOS policy 测试引入 `path.posix` 别名（例如 `const macPath = path.posix`），并将该测试中构造 expected、Applications、Desktop、`..` 等路径以及传给 `assertMacInstallTarget` 的 `pathApi` 统一改为 `macPath`。测试仍调用真实 policy 函数，只固定测试语义为 POSIX/macOS，不改生产代码。

如果发现 `selectMacApp` 测试也依赖当前平台 path separator，应同样只在测试中传 `path.posix`；不得扩大到生产模块。

## Expected files

- `tests/deploy-install.test.ts`
- `docs/changes/windows-ci-macos-path-test/execution.md`

## Implementation steps

1. 阅读本计划，确认基线和工作树；若有设计冲突停止。
2. 先修改 macOS policy 测试使用 `path.posix`，运行 focused test。
3. 运行 shell/help/check-only smoke tests 和全量质量门禁。
4. 记录命令、结果、Windows/PowerShell 未验证项到 execution.md。
5. 不提交、不 push，由 MASTER 审核后操作。

## Acceptance criteria

- `tests/deploy-install.test.ts` 在 macOS 和 Windows runner 都通过。
- macOS policy 测试不再依赖执行 runner 的默认 path flavor。
- 生产代码、安装脚本、workflow 未修改。
- 全量测试、lint、typecheck、build、diff check 通过。
- execution evidence 完整，无未批准偏差。

## Verification commands

```bash
npm test -- --run tests/deploy-install.test.ts
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
bash -n scripts/install.sh install-macos.command
./install-macos.command --help
(cd /tmp && /Users/renxiaowen/Desktop/japan-listener/install-macos.command --check-only)
git diff --check
```

## Compatibility and rollback

仅测试夹具和证据文档变化；回滚对应两个文件即可。

## Unresolved questions

None.
