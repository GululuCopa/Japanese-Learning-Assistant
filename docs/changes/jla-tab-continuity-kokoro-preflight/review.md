# Tab 切换分析连续性与 Kokoro 启动预检 — Review

**Status:** VERIFIED  
**Reviewer:** Codex MASTER  
**Date:** 2026-09-01  
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173` 加既有未提交 V0.1/Kokoro、usage fixes 和 history-open 修复。

## Review result

无未解决 finding。实现符合 `plan.md` 的冻结设计与范围。

### Chat lifecycle

- `App` 只保留一个常驻 `ChatPage`，通过 `.route-panel[hidden]` 切换可见性；隐藏面板不占布局，现有 main/page/Composer flex 结构得到保留。
- pending 已从单一 boolean 改为按 conversation id 隔离。相同 id 在 Notes/Settings/History Tab 来回时保留 optimistic 文本、图片和等待状态；打开另一历史 id 时不显示旧 pending。
- 前一历史修复的 `mountedRef`、current id 和 load generation 守卫仍存在；不同 id 的 stale send 不会覆盖当前会话。
- 新增 renderer 回归实际覆盖带 staged image 的 deferred send、Tab 来回、完成后分析展示，以及不同历史会话 pending 隔离。

### Kokoro preflight

- `launch.sh`/`launch.ps1` 只有在同目录存在 `start-cpu.*`、standalone executable 或 wrapper 支持的 Python venv 时才被视为可启动 runtime。
- placeholder-only root 在 spawn 前抛出 non-retryable `configuration`，不再等待 20 秒误报 network timeout。
- 健康端口复用、显式 `JLA_KOKORO_BIN`、有效 backing runtime、fallback port 和超时清理测试仍通过。
- Settings 文案已准确说明本地 Kokoro 需要安装 runtime/model，没有恢复远程 TTS 配置页面。

## Independent verification

由 MASTER 在 2026-09-01 独立执行：

```text
npm run format       exit 0
npm run lint         exit 0
npm run typecheck    exit 0
npm test -- --run    exit 0 — 23 files / 67 tests
npm run build        exit 0
npm run package:dir  exit 0 — darwin arm64 / Electron 44.1.0
JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev — exit 0, JLA_STARTUP_DB_OK
```

第一次 `package:dir` 在沙箱网络内因 `getaddrinfo ENOTFOUND github.com` 失败；按权限规则联网重试后 exit 0。该失败不是源码或打包配置错误。

LSP diagnostics 均为 0 errors：

- `src/renderer/App.tsx`
- `src/renderer/pages/ChatPage.tsx`
- `src/main/tts/kokoro-runtime.ts`
- `tests/renderer/chat-lifecycle.test.tsx`

## Remaining limitations

- 尚未使用真实 AI 在 macOS/Windows GUI 中手动执行“图片发送 → 切 Tab → 等待完成”。确定性 renderer 测试覆盖该状态机。
- 当前仓库仍没有 Kokoro runtime/model，因此发音现在会**快速、准确地提示缺少安装**，但不会生成音频。
- 真正开箱可用的 TTS 需要单独实现显式下载/安装、进度、校验、分平台包和许可声明；不属于本任务批准范围。
- 未执行 Windows installer 实机验证。

## Final decision

任务满足 acceptance criteria，标记 `VERIFIED`。未提交 Git；未修改 `docs/PRD.md`、`.DS_Store`、`docs/.DS_Store` 或 `.omx/`。
