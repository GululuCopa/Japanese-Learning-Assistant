# JLA TTS 一键安装 — Design

**Status:** VERIFIED

## Chosen architecture

继续使用官方 Kokoro-FastAPI-compatible HTTP provider；不采用 kokoro-js。应用内安装器负责下载并准备一个用户级、按平台的 portable runtime：

1. 下载并 SHA-256 校验固定版本 Astral `uv 0.12.8` binary。
2. 下载并 SHA-256 校验固定 commit 的官方 `Kokoro-FastAPI` source archive。
3. 解压到安装临时目录；使用 uv 管理 Python 3.12 venv。
4. 在 venv 中执行官方项目 CPU extra 安装（`.[cpu]`），由 `espeakng-loader` 提供当前平台的 eSpeak NG wheel。
5. 执行官方 model downloader，下载并校验 `kokoro-v1_0.pth` 与 `config.json`；source archive 已包含 `jf_alpha.pt` 和 `jm_kumo.pt` voice pack。
6. 写入版本/完整性 marker 后，将临时安装目录原子切换为正式安装目录。
7. `KokoroRuntime.resolveLaunch()` 优先识别此 managed install，并启动其 venv Python/uvicorn，不再每次启动重复 pip install 或下载模型。

不要依赖用户 PATH 中已有 python/uv，也不要调用未知 shell 命令。安装器可以使用 Node `child_process.spawn` 启动固定的 uv、venv Python 和 Windows PowerShell/系统归档工具；所有参数必须是数组参数，路径不得拼接进 shell 字符串。

## Main-process API

新增 typed service seam（命名可按现有项目约定调整，但语义必须保持）：

```ts
type KokoroInstallState =
  | { state: 'not-installed' }
  | { state: 'checking' }
  | { state: 'downloading'; phase: 'runtime' | 'source'; receivedBytes?: number; totalBytes?: number; percent?: number }
  | { state: 'installing'; phase: 'python' | 'dependencies' | 'model'; percent?: number; message?: string }
  | { state: 'verifying'; percent?: number }
  | { state: 'installed'; version: string; installedAt?: string }
  | { state: 'error'; message: string; retryable: boolean }

installKokoro(): Promise<KokoroInstallState>
getKokoroStatus(): Promise<KokoroInstallState>
cancelKokoroInstall(): Promise<void>
onKokoroProgress(listener): () => void
```

IPC channels must be added to `IPC_CHANNELS`, registered in main, and exposed only through preload. Progress is an event from main to the requesting renderer; payload is JSON-serializable and contains no arbitrary local paths or secrets. Cancellation is best effort and must kill only installer child processes created by this service.

## Manifest and downloads

The manifest is main-process-only and frozen in code. It must contain:

- Kokoro version `v0.8.1`, commit SHA, source archive URL and SHA-256 above.
- uv version `0.12.8`, platform/arch asset URL and SHA-256 above.
- Python version policy (`3.12`, exact patch may be resolved by uv but must be recorded in marker).
- Official model downloader/version and expected model filenames. If the model downloader is invoked, preserve its own upstream SHA checks; if the installer reimplements the download, use the exact upstream URLs and hashes from the pinned script.

Use streaming HTTP download with progress, a size guard, temp file, hash verification and atomic rename. An HTTP response with non-2xx, redirect loop, malformed content, or hash mismatch is an actionable retryable error. Do not follow arbitrary redirects to non-approved hosts; at minimum restrict final URLs to the fixed GitHub/official model hosts used by the manifest.

## Runtime launch

Managed install launch must:

- bind localhost only and use the already selected fallback port from `KokoroRuntime`;
- set `USE_GPU=false`, `MODEL_DIR`, `VOICES_DIR`, `PYTHONPATH`, `PHONEMIZER_ESPEAK_LIBRARY`/data env only when required by the platform package;
- use `uv run --no-sync` or the venv Python to launch `uvicorn api.src.main:app`, with no install/download on the playback path;
- preserve current health polling, timeout, cleanup, and `/v1/audio/speech` contract.

If an existing healthy local Kokoro server is found, reuse it as before. A managed install should be preferred only when no healthy server exists and no explicit developer `JLA_KOKORO_BIN` override is active.

## Renderer behavior

Settings page under 发音 should show:

- not installed: `本地语音引擎未安装` + `一键安装语音引擎` button + short size/network notice;
- downloading/installing: phase text, progress when known, disabled install button, `取消安装`;
- installed: `本地语音引擎已安装` + version/ready text + `重新安装` and optionally `删除本地引擎` only if safely implemented;
- error: actionable message + `重试`.

Keep female/male as the only voice choice. Do not add TTS URL/model/API-key fields. Catch install errors in UI so settings page remains usable.

## Failure and rollback

- Use `install.tmp-*` plus `install.json` marker. Never mark installed before runtime binary, venv, source, model, config and required voice files exist.
- On failure/cancel, terminate children, delete only current temp directory, keep previous verified install untouched.
- Reinstall builds a new temp version and swaps only after all checks pass.
- If disk/network/python dependency install fails, show a retryable message with phase; do not silently fall back to remote TTS.
- If platform unsupported, show a non-retryable platform message and keep current manual developer override behavior.

## License/documentation

Update `resources/kokoro/README.md` and root `README.md` to explain that the app downloads third-party Kokoro-FastAPI source/runtime/model on explicit user action, list upstream project/version and licenses (Kokoro-FastAPI/Kokoro and uv/eSpeak dependencies), approximate download size if known, cache location conceptually, and troubleshooting. Do not claim assets are bundled.

## Expected implementation files

Likely scope (executor may add focused files under these modules only):

- `src/main/tts/kokoro-installer.ts` (new)
- `src/main/tts/kokoro-runtime.ts`
- `src/main/app-services.ts`
- `src/main/ipc/register.ts`
- `src/preload/index.ts`
- `src/shared/constants.ts`
- `src/shared/types.ts`
- `src/renderer/pages/SettingsPage.tsx`
- `src/renderer/styles/app.css` only if needed
- `tests/kokoro-installer.test.ts` (new)
- `tests/kokoro-runtime.test.ts`
- `tests/settings-voice.test.ts` or focused renderer settings test
- `resources/kokoro/README.md`
- `README.md`
- `docs/changes/jla-tts-one-click-install/execution.md`

Do not modify unrelated files or generated `out/` artifacts.
