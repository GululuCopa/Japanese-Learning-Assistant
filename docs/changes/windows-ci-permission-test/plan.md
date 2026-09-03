# Windows CI Permission Test Fix

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Master:** Codex
**Executor:** Herdr Grok 4.6 xhigh
**Date:** 2026-09-03
**Baseline commit:** `5a9fb898d4401efb69427a6b33a3f398f76e809e`

## Objective

修复 GitHub Actions Windows workflow 中 `tests/obsidian-delete.test.ts` 的跨平台权限失败测试。当前测试使用 Unix `chmod 0555` 模拟不可删除目录，Windows NTFS 不会按该方式拒绝当前用户删除，导致 CI 在第 156 行失败。测试必须在 Windows、macOS、Linux 上以确定性方式覆盖“Obsidian Markdown 删除失败时保留 SQLite 收藏记录”的业务行为。

## Non-goals

- 不修改生产删除流程、路径安全策略或 IPC 合同。
- 不改变 Windows workflow 的测试范围。
- 不引入真实权限修改、管理员权限、平台特定外部工具或网络依赖。
- 不修改 `docs/PRD.md`、既有历史变更文档、`.DS_Store` 或 `.omx/`。

## Current evidence

GitHub Actions run `33717392449`, commit `5a9fb898`, Windows job `100529355376`：

- Install dependencies、Lint、Typecheck 通过。
- Test 失败，Build 和 Package Windows 被跳过。
- annotation：`tests/obsidian-delete.test.ts:156`，`expected [Function] to throw an error`。
- 失败测试在导出后对父目录执行 `fs.chmodSync(dir, 0o555)`，这在 Unix 有效但在 Windows 不构成 NTFS ACL 拒绝。

## Approved design

将权限失败测试改为确定性注入/模拟真实删除边界：让 `fs.unlinkSync` 在该测试中针对目标文件抛出带 `code: 'EPERM'` 或 `EACCES` 的错误，并在 `finally` 中恢复 spy/mock。测试仍通过 `AppServices.deleteNote()` 走完整生产调用链，断言：

1. 删除抛出可操作的权限错误。
2. SQLite 收藏记录仍存在。
3. Obsidian Markdown 文件仍存在。
4. 测试结束后 mock 必须恢复，不影响其他测试。

优先使用 Vitest 的 `vi.spyOn(fs, 'unlinkSync')` / `mockImplementation` 或等价的既有测试约定；如果 ESM/CJS 绑定使该 seam 不可 mock，停止并在 execution.md 记录，不得修改生产代码来迎合测试。可保留 Unix chmod 语义测试，但不得让它成为 Windows workflow 的必需断言；默认只保留一个跨平台确定性测试即可，避免重复覆盖。

## Expected files

- `tests/obsidian-delete.test.ts`
- `docs/changes/windows-ci-permission-test/execution.md`

如需最小测试辅助改动，只能限于 `tests/`，并说明理由；生产源码和 workflow 不应修改。

## Implementation steps

1. 读取本计划并确认基线与工作树；若发现设计冲突先停止。
2. 修改权限失败测试为跨平台确定性 mock，保留完整 `AppServices.deleteNote()` 调用链和数据库保留断言。
3. 运行 focused test，确认通过，并检查 mock 恢复。
4. 运行 format、lint、typecheck、全量测试、build、git diff --check。
5. 将命令、结果、未验证项和变更文件记录到 `execution.md`。

## Acceptance criteria

- `tests/obsidian-delete.test.ts` 在当前 macOS 通过。
- 同一测试不依赖 `chmod 0555` 或 Windows 不支持的权限行为。
- 测试模拟 `EPERM`/`EACCES` 后，收藏记录不被删除、导出 Markdown 仍存在。
- 全量测试通过，且无生产代码/workflow/受保护文件的非批准改动。
- execution evidence 完整且没有未批准偏差。

## Verification commands

```bash
npm test -- --run tests/obsidian-delete.test.ts
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
git diff --check
```

## Compatibility and rollback

该修复只改变测试夹具，不影响运行时行为。回滚只需恢复 `tests/obsidian-delete.test.ts` 和本变更文档。

## Unresolved questions

None.
