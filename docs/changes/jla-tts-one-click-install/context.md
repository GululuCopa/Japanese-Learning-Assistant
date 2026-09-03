# JLA TTS 一键安装 — Context

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Master:** Codex
**Executor:** 右侧 Herdr Grok 4.6 xhigh（唯一实现者）
**Baseline:** `065c9ba feat: add Japanese learning assistant desktop app`
**Baseline dirty files:** 无（以委托前 `git status --short` 为准）

## Objective

将当前需要用户手动准备 Kokoro-FastAPI runtime/model 的流程改为应用内设置页“一键安装本地语音引擎”，覆盖 Windows 10/11 x64 与 macOS arm64/x64。安装完成后，现有本地 `/v1/audio/speech` provider 能直接启动并发音；不下载、不提交大模型权重到 Git。

## Non-goals

- 不改 `docs/PRD.md`。
- 不改 AI provider、对话、图片分析、数据库 schema 或历史会话行为。
- 不把模型权重或 Python venv 提交进仓库或 Electron asar。
- 不支持 Linux 安装 UI（现有 Linux 资源可保留，但本任务验收平台为 Windows/macOS）。
- 不允许 renderer 提供任意下载 URL、命令、路径或环境变量。
- 不在应用启动/npm install 时静默下载；只有用户点击安装才执行。
- 不替换为 kokoro-js：只读调查确认 npm kokoro-js 1.2.1 的示例/voice 列表是英语 voice，不能满足当前日语 `jf_alpha`/`jm_kumo` 合同。

## Verified current behavior

- `src/main/tts/kokoro-runtime.ts` 只查找已有服务/launcher，缺 runtime 时抛出“未安装运行时或日语模型”。没有安装 IPC、状态、进度、取消。
- `src/main/app-services.ts` 只有 `kokoro.ensureReady()` 和 `speak()`，没有安装生命周期。
- `src/main/ipc/register.ts` 只有 `tts:speak`，没有 TTS install/status/progress/cancel channel。
- `src/preload/index.ts` 未暴露安装能力。
- `src/renderer/pages/SettingsPage.tsx` 仍显示“需安装 runtime/model”的静态说明，没有按钮或状态。
- `electron-builder.yml` 只打包 `resources/kokoro/launch.ps1`, `launch.sh`, `README.md`，没有 runtime/model。
- `resources/kokoro` 明确是 launcher hook，不包含 runtime、venv、模型。
- 当前 provider 使用本地 `POST /v1/audio/speech`，voice 映射为 `female -> jf_alpha`、`male -> jm_kumo`。

## External evidence

- npm `kokoro-js` 当前公开版本为 `1.2.1`，官方 README 示例使用 `onnx-community/Kokoro-82M-v1.0-ONNX` 和英语 voice（如 `af_heart`），声明 node 可用 `device: "cpu"`；未提供本项目所需日语 `jf_*`/`jm_*` voice 合同。
- 官方 `remsky/Kokoro-FastAPI` release `v0.8.1` 发布于 **August 24, 2026**，tag commit 为 `d5d1a69566c47659b7ae434cf62cafb124660183`，README 明确支持 Japanese、Windows 的 `start-cpu.ps1` 和 macOS/Linux 的 `start-cpu.sh`，OpenAI-compatible endpoint 为 `http://localhost:8880/v1`。
- 官方 `v0.8.1` `pyproject.toml` 要求 Python `>=3.10`，CPU extra 使用 `torch==2.8.0`，并依赖 `espeakng-loader==0.2.4`、`kokoro==0.9.4`、`misaki[en,ja,ko,zh]==0.9.4` 等；`espeakng-loader` wheel 包含平台原生 eSpeak NG 和日语 `ja_dict` 数据，因此安装流程应让 pip/uv 选择当前平台 wheel，不再要求用户手动安装 eSpeak。
- 官方 `docker/scripts/download_model.py` 固定校验 `kokoro-v1_0.pth` 和 `config.json` SHA-256，并将模型放入 `api/src/models/v1_0`；voice pack（含 `jf_alpha.pt`、`jm_kumo.pt`）在官方 source tree 中存在。
- 官方 Astral uv `0.12.8` release 提供 `uv-x86_64-pc-windows-msvc.zip`、`uv-aarch64-apple-darwin.tar.gz`、`uv-x86_64-apple-darwin.tar.gz`。固定 SHA-256：
  - Windows x64: `e07acf3f8a29fe41f9e04b799c3325cb0e0893836bb222bf102829b45c679ad6`
  - macOS arm64: `8ce083658dbff20143607ca7af8e0c1d64b6fd7bf03a5cdcb62bf3d47d991b5f`
  - macOS x64: `bfcd4407de99e0a2c1904df0902fa1795653d4edd145358e6561527e746a4f16`
- 固定 Kokoro-FastAPI commit ZIP SHA-256（`https://github.com/remsky/Kokoro-FastAPI/archive/d5d1a69566c47659b7ae434cf62cafb124660183.zip`）为 `6655e1a4493e58d05bfc9137bc6a69d503052c33256cec18eab5e85b821fd65e`（约 46.9 MB，包含 source 和 voice pack；Windows/macOS 均可使用 ZIP 解压路径）。

参考官方资料：

- `https://github.com/remsky/Kokoro-FastAPI/releases/tag/v0.8.1`
- `https://github.com/remsky/Kokoro-FastAPI/blob/v0.8.1/README.md`
- `https://github.com/remsky/Kokoro-FastAPI/blob/v0.8.1/pyproject.toml`
- `https://github.com/remsky/Kokoro-FastAPI/blob/v0.8.1/start-cpu.ps1`
- `https://github.com/remsky/Kokoro-FastAPI/blob/v0.8.1/start-cpu.sh`
- `https://github.com/remsky/Kokoro-FastAPI/blob/v0.8.1/docker/scripts/download_model.py`
- `https://www.npmjs.com/package/kokoro-js`
- `https://github.com/astral-sh/uv/releases/tag/0.12.8`

## Compatibility constraints

- 只允许 Windows x64、macOS arm64/x64 进入“一键安装”流程；其他平台返回可读的“不支持该平台”错误，不得下载错误架构的可执行文件。
- 所有安装路径使用 `path.join`/Node path API；不要硬编码 `/` 或假定 shell 语法。
- 安装目录位于 Electron `app.getPath('userData')` 下的专用目录（例如 `kokoro-runtime`），临时文件使用同目录临时子目录，成功后原子替换/marker 写入。
- 下载源、版本、提交和 SHA-256 必须在主进程固定 manifest 中，renderer 不可覆盖。
- 失败或取消不得破坏已有已验证安装；不得把半成品当作 installed。
