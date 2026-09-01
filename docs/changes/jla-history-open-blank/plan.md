# 历史会话打开后空白 — Task Packet

**Status:** VERIFIED  
**Mode:** IMPLEMENT  
**Master:** Codex  
**Executor:** 右侧 Herdr Grok（Grok 4.6 xhigh）唯一实现者  
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173`；当前仓库的大量 V0.1/Kokoro 实现与 `docs/changes/` 均为未提交工作区内容，必须保留，不得提交、回滚或清理。

## Objective

修复用户点击“历史”中的会话后，聊天页偶发不展示内容/显示空白的问题。修复必须覆盖异步竞态和加载失败场景，并保持 Windows 10/11 x64 与 macOS 兼容。

## Non-goals

- 不修改 `docs/PRD.md`、`.DS_Store`、`docs/.DS_Store` 或 `.omx/`。
- 不改数据库 schema、IPC 协议、AI/TTS provider、附件存储策略或导航布局。
- 不引入流式响应或重做 Chat 页面。
- 不削弱任何 Zod/IPC 校验。
- 不提交 Git commit，不执行 reset/checkout/clean 等破坏性操作。

## Current behavior and evidence

源代码证据：

- `src/renderer/pages/ChatPage.tsx` 使用组件内 `skipNextLoad` boolean。创建新会话或首次发送时将其设为 `true`，随后通过 `onConversationChange` 切换 id；effect 可能跳过下一次加载，但没有按 id 绑定，也没有在跳过时显式结束 loading。
- 同一文件中的 `api.conversations.get(conversationId)` 只有 `then/finally`，没有 `catch`；IPC/repository 查询拒绝时，页面没有错误状态，可能落入无内容/无错误提示。
- `send()` 的异步完成路径会 reload/切换会话状态；若用户在模型响应期间进入历史并打开另一会话，旧发送完成后可能覆盖当前选中的会话 detail。Grok 的临时 `/tmp` 复现确认该竞态：发送未完成 → History → 打开有内容的会话 → 发送完成，已有内容被替换成空 CTA。
- 右侧 Grok 的只读诊断（未修改仓库，临时复现 `7` 绿 `1` 红）确认：
  - 正常点击有内容会话可加载；
  - `get` rejection 会出现空 CTA、无错误文案和 unhandled rejection；
  - `get` 延迟期间只显示加载态；
  - boolean skip 在不卸载直接切 id 时会导致 `get(c-full)` 不调用；
  - send 完成后的旧异步结果可覆盖用户后来打开的历史会话。

## Approved design decisions

1. **按会话 ID 跳过乐观加载：** 将 boolean `skipNextLoad` 改为 `skipLoadForId: string | null`（或等价的、只对创建/首次发送生成的具体 id 生效的机制）。只允许跳过与该 id 相同的 effect；跳过时必须清理该 id 的 loading 状态。历史会话不能被跳过。
2. **显式加载错误：** `conversations.get()` 失败时设置用户可见的 `error`，清理 `loading`，保留已有 detail（若有），不显示误导性的“还没有消息”空 CTA；必要时在 Chat 页面使用现有 `StatusBanner`/等价错误 UI。
3. **异步代际/挂载守卫：** 为加载、reload、send 完成路径增加 mounted/generation 或等价守卫；只有当请求仍对应当前会话/当前组件时，才能调用 `setDetail`、`setLoading`、`onConversationChange`。用户从发送中的会话切换到历史会话后，旧 send 不得覆盖当前会话。
4. **保持现有功能：** 新会话创建、首次发送的乐观用户消息、重试、附件显示、错误可重试行为不得回归；不改变 IPC 或数据库接口。
5. **回归测试优先：** 增加 renderer 测试，至少覆盖：
   - 从历史打开有消息会话，`get` 被调用且消息显示；
   - `get` rejection 显示错误且不显示空 CTA；
   - skip 只对同一新会话 id 生效，切换到其他历史 id 必须加载；
   - send deferred 时切换到历史会话，旧 send 完成后当前历史内容仍保留。

## Expected affected files/modules

- `src/renderer/pages/ChatPage.tsx`
- `tests/renderer/app.test.tsx` 或新增 `tests/renderer/chat-history.test.tsx`
- 如确有必要，仅调整 `tests/helpers/fake-api.ts` 以支持多会话/延迟测试；不得扩大实现范围。

## Implementation steps

1. 阅读本 packet 与仓库指令，确认当前代码与范围一致；若需要设计/架构/协议变更，停止并报告，不自行扩 scope。
2. 先添加能复现上述四类行为的 renderer 回归测试。
3. 按 approved design 修改 ChatPage 异步状态与错误处理。
4. 运行格式化、lint、typecheck、相关测试及完整测试/构建命令。
5. 将实际改动、命令输出、失败与未验证项记录到 `docs/changes/jla-history-open-blank/execution.md`。

## Acceptance criteria

- 点击历史会话后，已有消息稳定展示，不因 `skipNextLoad` 或旧请求而变空。
- 选择的历史会话的 `conversations.get(id)` 必须实际调用；历史 id 不得命中新会话的跳过逻辑。
- 读取失败时页面显示可理解的错误状态，不出现无错误的空白/空 CTA。
- 在模型响应期间切换会话，旧请求完成不得覆盖当前选中会话。
- 现有新会话、发送、重试、图片、收藏和设置行为无回归。
- 不新增平台特定路径/命令；Windows/macOS 行为仅依赖现有 Electron/React API。

## Verification commands

```bash
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run package:dir
```

如环境允许，再执行：

```bash
JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev
```

## Rollback / failure considerations

- 若测试暴露需要修改 IPC、数据库或共享类型，停止实现并回报；由 MASTER 更新 packet 后再继续。
- 若某个验证命令因既有环境/平台问题失败，记录完整错误，不伪报成功。
- 回滚仅允许由 MASTER 在明确审查后进行；EXECUTOR 不得执行 destructive Git 操作。

## Unresolved questions

无。当前设计已由源码证据和 Grok 临时复现确定；实现过程中不得自行扩大范围。
