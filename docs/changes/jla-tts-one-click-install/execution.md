# JLA TTS 一键安装 — Execution Evidence

**Executor:** right-side implementation writer (Grok 4.6)
**Date:** 2026-09-01
**Mode:** IMPLEMENT + FIX_REVIEW
**Host:** macOS darwin arm64
**Git operations:** none

## Summary

Settings 发音区提供「一键安装语音引擎」。主进程固定 manifest 下载并校验 uv `0.12.8` 与 Kokoro-FastAPI `v0.8.1`（commit `d5d1a695…`）源码包、官方 `kokoro-v1_0.pth`/`config.json`，用 uv 创建 Python 3.12 venv 并安装 `.[cpu]`，校验 `jf_alpha.pt`/`jm_kumo.pt` 后原子切换 `userData/kokoro-runtime/current`。失败/取消只删临时目录。`KokoroRuntime` 在无健康服务且无 `JLA_KOKORO_BIN` 时用 venv Python 启动 `uvicorn api.src.main:app` 并转发已选端口。未做真实网络安装。

## FIX_REVIEW (2026-09-01)

1. `managedInstallComplete` / `managedLaunchSpec` require `marker.platform === ${platform}-${arch}`，避免 macOS arm64/x64 共用 userData 时启动错误架构 venv。测试：另一 arch 的 marker 视为未安装。
2. `commitInstall` 先写入 `tmp/install.json` 并切换 `current`，再写 root `install.json`；root marker 失败则恢复 `current.bak` 与 `install.json.bak`。测试：marker 写入失败后旧 verified install 与 marker 保持。
3. Windows zip 使用 PowerShell `Expand-Archive`（独立 argv，不拼 shell 字符串）。Kokoro-FastAPI source 已改为同一 commit 的官方 `.zip`（SHA-256 `6655e1a4…`），因此 Windows 上 uv 与 source 都走 Expand-Archive。macOS uv 仍为 tar.gz（`tar`）；macOS source zip 亦用 `tar -xf`。
4. `AppServices.installKokoro()` 在安装前调用 `kokoro.stop()`，只结束本进程 spawn 的 child，避免 Windows 上重新安装时 `.venv` 被锁。外部健康服务复用不受影响。失败后旧安装仍可 `ensureReady` 再启动。测试：`tests/tts-install-stop.test.ts` 覆盖 stop → install 顺序与失败后再 spawn。

## Verification

### `npm run format`

Exit **0**.

### `npm run lint`

Exit **0**.

### `npm run typecheck`

Exit **0**.

### `npm test -- --run`

Exit **0**.

```text
 Test Files  27 passed (27)
      Tests  87 passed (87)
```

### `npm run build`

Exit **0**. main bundle `out/main/index.js` 97.04 kB.

### `npm run package:dir`

Exit **0**. `platform=darwin arch=arm64 electron=44.1.0` → `release/mac-arm64`. extraResources 仍仅为 launcher 三文件。

## Deviations

- 未实现「删除本地引擎」（设计为可选）。
- 未设置 `PHONEMIZER_ESPEAK_LIBRARY`（依赖 `espeakng-loader` wheel；未在真机验证）。
- 模型下载由安装器按官方 `download_model.py` 的 URL/SHA-256 实现，而不是再 spawn 该 Python 脚本（便于取消、进度和单测）。

## Failures

Listed commands did not fail.

## Unverified areas

- 未在 Windows 10/11 x64 或 macOS x64 上点击一键安装。
- 未实际下载 uv / FastAPI `.zip` archive / `kokoro-v1_0.pth`（约 1 GB）或跑 `uv pip install .[cpu]`。
- 安装完成后的真实 `/v1/audio/speech` 发音未验证。
- 未跑 `package:win`。

## Changed files

```text
src/shared/types.ts
src/shared/constants.ts
src/main/tts/kokoro-manifest.ts
src/main/tts/kokoro-download.ts
src/main/tts/kokoro-installer.ts
src/main/tts/kokoro-runtime.ts
src/main/app-services.ts
src/main/ipc/register.ts
src/preload/index.ts
src/renderer/pages/SettingsPage.tsx
src/renderer/styles/app.css
tests/kokoro-installer.test.ts
tests/kokoro-runtime.test.ts
tests/tts-install-ipc.test.ts
tests/tts-install-stop.test.ts
tests/renderer/settings-tts.test.tsx
tests/renderer/app.test.tsx
tests/helpers/fake-api.ts
resources/kokoro/README.md
README.md
docs/changes/jla-tts-one-click-install/execution.md
```

`docs/PRD.md` 未修改。未提交 Git。

## MASTER Final Verification

- Exact diff reviewed against baseline `065c9ba`; only the approved task packet scope plus its planning/evidence files changed. `docs/PRD.md`, `.DS_Store`, `.omx/`, generated `out/` and downloaded model/runtime assets were not added.
- `git diff --check`: exit 0.
- Re-ran `npm run format`, `npm run lint`, `npm run typecheck`, `npm test -- --run`: all exit 0; **27 test files / 87 tests passed**.
- Re-ran `npm run build`: exit 0.
- Re-ran `npm run package:dir` with network approval: exit 0; macOS arm64 Electron directory package created. Packaged resources contain only the three Kokoro launcher documentation/script files; no model weights, uv binary, or venv are bundled.
- Re-ran `JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev`: exit 0 and emitted `JLA_STARTUP_DB_OK`; no renderer white-screen/startup failure observed in smoke mode.
- MASTER findings resolved: platform/architecture marker matching, atomic root-marker rollback, Windows ZIP extraction via PowerShell, fixed source archive changed to official commit ZIP, and stopping the app-owned Kokoro child before reinstall.

The following remain intentionally unverified because this host is macOS arm64 and the real install is a large network operation: clicking the full installer on Windows 10/11 x64 and macOS x64; downloading the actual roughly 1 GB dependency/model set; `uv pip install .[cpu]` against live upstream; real post-install Kokoro startup/audio generation; and `npm run package:win`.

**MASTER status: VERIFIED.**
