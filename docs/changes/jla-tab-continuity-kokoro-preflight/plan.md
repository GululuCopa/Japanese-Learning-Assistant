# Tab 切换分析连续性与 Kokoro 启动预检 — Task Packet

**Status:** VERIFIED  
**Mode:** IMPLEMENT  
**Master:** Codex  
**Executor:** 右侧 Herdr Grok（Grok 4.6 xhigh）唯一实现者  
**Date:** 2026-09-01  
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173` 加当前未提交 V0.1/Kokoro 与历史修复工作区内容。所有既有用户文件必须保留。

## Objective

1. 用户发送文本/图片分析后，在 AI 未完成时切换左侧 Tab，再回到同一个对话，等待状态和最终回复必须连续展示。
2. 当项目只有 Kokoro launcher hook、实际 runtime/model 未安装时，点击发音必须立即返回准确、可操作的配置错误，不能盲等 20 秒后误报启动超时。

## Non-goals

- 本任务不下载或打包 Kokoro 模型、Python/ONNX runtime；真正可发音的跨平台安装流程另行立项。
- 不改 AI/TTS IPC schema、数据库 schema、provider 请求协议或消息持久化结构。
- 不引入轮询、后台 worker 或全局任务系统。
- 不修改 `docs/PRD.md`、`.DS_Store`、`docs/.DS_Store`、`.omx/`。
- 不提交、reset、checkout、clean 或执行破坏性 Git 操作。

## Current behavior and evidence

### Tab continuity

- `src/renderer/App.tsx` 仅在 `page === 'chat'` 时渲染 `ChatPage`，切到 Notes/History/Settings 会卸载 Chat。
- `src/renderer/pages/ChatPage.tsx` 的 `mountedRef` 在卸载后变为 false；deferred `messages.send` 完成时 `stillCurrent()` 返回 false，完成结果被丢弃。切回同 id 会创建新 ChatPage，只做一次 `get`，不再订阅旧 promise。
- Grok 在 `/tmp/jla-tab-switch-lost-reply.test.tsx` 建立确定性 red repro，命令：

```bash
npx vitest run --config /tmp/jla-tab-switch-lost-reply.vitest.config.ts
```

- 红色结果：发送 → 切“笔记” → 切回“对话”（请求仍 pending）→ release send；期望显示 assistant 分析“别管我”，实际显示“新对话”与空 CTA，`queryByText('别管我')` 超时。
- 主进程 `ConversationService.send` 在调用 provider 前已持久化 user message，provider 完成后持久化 assistant message；请求本身没有因 Tab 切换取消。用户随后确认结果很晚才出现，符合重新加载数据库的竞态而非请求取消。

### Kokoro preflight

- `resources/kokoro/README.md` 明确写明 `Local Kokoro runtime (not bundled)`。
- 实际目录只有 `README.md`、`launch.sh`、`launch.ps1`；用户目录与主机扫描未发现 `start-cpu.*`、Kokoro executable、Python venv 或模型权重。
- `KokoroRuntime.resolveLaunch()` 把占位 `launch.sh/launch.ps1` 当成可运行引擎；wrapper 缺少 runtime 时立即 exit 1。
- `defaultSpawn()` 使用 `stdio: 'ignore'` 且 `SpawnedProcess` 没有退出通知，`ensureReady()` 因而继续健康检查 20 秒，最后抛出 retryable network timeout，而真实原因是 configuration/runtime missing。

## Approved design decisions

### A. 保持 Chat 生命周期但继续隔离不同会话

1. `App` 始终挂载唯一一个 `ChatPage`；非 Chat Tab 仅通过有明确 `[hidden]` 行为的 route panel 隐藏，避免卸载。不得复制多个 Chat 实例。
2. 新增最小 route panel CSS，使可见 Chat 仍保持当前 flex/滚动/Composer 布局，隐藏时不占空间、不参与可访问性交互。
3. 将 pending 状态绑定到 conversation id（Set/map/count 或等价机制），避免旧会话的 pending 指示出现在用户后来打开的另一历史会话；同 id Tab 来回应保留 pending。
4. 保留前一任务的 stale guards：发送中打开**不同 conversation id** 后，旧结果不得覆盖当前历史会话；仅 Tab 切换且 id 未变时，完成结果必须正常 reload。
5. 图片的 optimistic preview、持久化图片读取和错误重试行为保持不变。

### B. Kokoro runtime 准确预检

1. launcher hook 本身不是 runtime。只有存在实际 backing entrypoint/runtime（如 `start-cpu.*`、standalone executable，或 wrapper 支持的 Python venv）时，runtime root 才可被 `resolveLaunch()` 接受。
2. 显式 `JLA_KOKORO_BIN` 仍作为开发者 override；保持绝对路径与文件存在校验，不把 renderer 输入用于进程启动。
3. 对仓库/packaged/userData 中只有 `launch.sh/launch.ps1 + README` 的 placeholder root，`ensureReady()` 必须在 spawn 前抛出 non-retryable `configuration` 错误，文案明确说明“仅有启动脚本，未安装运行时/模型”，并指向 README 中允许的位置/环境变量。不得等待 readiness timeout。
4. 如实现者能在不扩大公共 API 的前提下小范围捕获 child early-exit，可加入快速、准确的“进程启动后退出”错误；若需要重构进程抽象或跨模块协议，停止并报告，不扩大 scope。
5. Settings 中不得继续暗示当前包已内置完整引擎；最小调整说明为“由本地 Kokoro 完成，但需安装 runtime/model”，不恢复远程 TTS 配置页面。

## Expected affected files

- `src/renderer/App.tsx`
- `src/renderer/styles/app.css`
- `src/renderer/pages/ChatPage.tsx`（仅 pending-by-conversation 所需最小改动）
- `tests/renderer/chat-history.test.tsx` 或新增 renderer lifecycle test
- `src/main/tts/kokoro-runtime.ts`
- `src/renderer/pages/SettingsPage.tsx`（仅准确说明）
- `tests/kokoro-runtime.test.ts`
- 如测试 helper 必须扩展，可最小改 `tests/helpers/fake-api.ts`
- `docs/changes/jla-tab-continuity-kokoro-preflight/execution.md`

## Implementation steps

1. 阅读本 packet、仓库指令和相关现有历史修复；若发现设计冲突，停止并报告。
2. 先加入两个 red-capable 回归：
   - deferred send + staged image/text + 非 Chat Tab 来回 + release 后 assistant/图片/用户消息存在；
   - placeholder-only Kokoro root 立即 configuration error、不得 spawn/等待 timeout。
3. 实现始终挂载 Chat 的 route panel 和按会话隔离 pending；确保“发送中打开另一历史会话”现有测试仍绿。
4. 实现 Kokoro backing-runtime preflight 和准确 Settings 文案。
5. 运行全部验证并记录到 `execution.md`。

## Acceptance criteria

- 同一 conversation id 下，AI 请求期间切换 Notes/History/Settings 再回来，optimistic 用户消息、图片、等待状态不会消失；请求完成后自动显示 assistant 分析，无需再次切 Tab 或手动刷新。
- 若在请求期间从 History 打开另一 conversation id，旧请求不得覆盖新会话，且新会话不显示旧会话 pending。
- Chat 隐藏时不占布局、不暴露可交互按钮给正常可访问性查询；导航和固定侧栏行为不回归。
- 当前 launcher-only 仓库点击发音应快速显示 configuration 错误；测试不得真实等待 20 秒。
- 已安装有效 runtime 或显式 `JLA_KOKORO_BIN` 的既有启动路径保持可用。
- Windows 10/11 x64 与 macOS 不使用新增平台特定 renderer API；平台差异仅留在现有 main runtime resolver。

## Verification commands

```bash
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run package:dir
JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev
```

## Rollback / failure considerations

- route panel 若破坏 Composer/main flex 尺寸，必须通过 CSS 修正，不回到多个 ChatPage 实例。
- Kokoro 预检不能把有效的 `start-cpu`、standalone binary、venv 或显式 override 判为缺失；测试需覆盖有效路径。
- 若真正修复发音需要下载模型/新增大型依赖，停止在本任务范围外，由 MASTER 单独立项。

## Unresolved questions

无阻塞问题。真正可用的 Kokoro runtime 安装策略不属于本 packet。
