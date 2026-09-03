# Japanese Learning Assistant

Japanese Learning Assistant 是一个面向日语学习者的桌面应用，尤其适合在玩日语游戏、阅读漫画或查看截图时快速理解日语内容。

项目的核心目标是把一次“看不懂”转化为完整的学习闭环：

```text
文本 / 游戏截图
    ↓
结构化日语分析
    ↓
原文、读音、翻译、词汇、语法、语气与上下文
    ↓
发音、收藏、历史复习
    ↓
Obsidian 笔记沉淀
```

本项目基于 Electron + React + TypeScript 构建，支持 **Windows 10/11 x64**，也支持在 **macOS** 上开发和运行。

> 当前版本为 V0.1。AI 分析使用 OpenAI-compatible API；发音使用 Windows / macOS 已安装的日语系统语音，无需下载模型、启动本地引擎或填写 TTS API Key。详见 [系统日语发音](#系统日语发音)。

## 项目目标

- **降低查词成本**：在游戏或阅读过程中直接粘贴文本、拖入截图即可提问。
- **从翻译升级到学习**：除了翻译，还展示读音、词汇、语法、语气、上下文和学习重点。
- **保留真实语境**：每次分析都可以回到历史对话，避免只留下孤立的单词释义。
- **形成个人知识库**：将单词、句子、语法和截图保存到笔记，并导出到 Obsidian。
- **保持低摩擦体验**：发送后立即显示用户消息和图片，模型分析期间可以切换其他 Tab，回到对话后结果会继续显示。
- **优先保护本地数据**：API Key 保存在 Electron `userData` 中，并尽可能使用操作系统安全存储加密。

## 核心功能

### 1. 文本和图片提问

- 输入日语文本并询问“什么意思”“这里的语气是什么”等问题。
- 支持选择或拖拽 PNG、JPG、JPEG、WebP 图片。
- 支持调用具备视觉能力的 OpenAI-compatible 多模态模型分析截图。
- 图片会保存在当前对话中，重新打开历史对话后仍可查看。
- AI 回复期间会立即展示用户消息、图片和“正在分析”状态。
- 在“对话 / 笔记 / 历史 / 设置”之间切换时，当前分析任务不会因为界面切换而丢失。

### 2. 结构化日语分析

分析卡片包含：

- 原文
- 假名读音
- 中文翻译
- 字面翻译
- 词汇拆解
- 词性、词义和词汇解释
- 例句
- 语法模式和语法说明
- 语气分析
- 上下文说明
- 学习重点
- AI 推荐收藏项

### 3. 系统日语发音

- 使用操作系统自带的日语语音：macOS 的 `say`，Windows 的系统 Speech API。
- 支持女声和男声两个偏好；若对应性别的日语语音不可用，会回退到已安装的任意日语系统语音。
- 支持 `0.75x` 和 `1.0x` 播放速度（生成一份常速音频，由播放器调整倍速）。
- 音频结果会缓存，重复播放相同文本和音色时不会再次合成。
- 仅在用户点击发音时生成音频，不启动常驻服务、容器或 Python runtime。
- 发音在主进程完成，不向 renderer 暴露 Node.js 或文件系统能力。

### 4. 收藏和笔记

可以收藏：

- 单词
- 句子
- 语法

收藏内容包括原始句子、翻译、解释以及关联截图。笔记页支持搜索和查看已保存内容。

### 5. Obsidian 导出

支持将笔记导出到用户选择的 Obsidian Vault：

```text
Japanese/Words
Japanese/Sentences
Japanese/Grammar
Japanese/Assets
```

导出过程会限制路径必须位于用户选择的 Vault 内，避免路径穿越到 Vault 外部。

### 6. 对话历史

- 查看历史对话列表。
- 点击历史对话加载完整消息和分析结果。
- 历史打开失败时显示明确错误，不会出现无提示空白页。
- 发送中的旧对话不会覆盖后来打开的其他历史对话。

## 技术架构

```text
src/
├── main/                    Electron 主进程、IPC、SQLite、AI/TTS 服务
│   ├── ai/                  OpenAI-compatible AI provider
│   ├── attachments/         图片存储与安全读取
│   ├── conversation/        对话和消息服务
│   ├── database/            better-sqlite3 数据访问
│   ├── notes/               收藏、笔记和 Obsidian 导出
│   └── tts/                 系统 TTS provider（Windows / macOS）
├── preload/                 contextIsolation 下的类型化安全桥接
├── renderer/                React 页面和组件
└── shared/                  类型、schema、错误和 provider contract
```

安全边界：

- `contextIsolation: true`
- `nodeIntegration: false`
- renderer 只能使用类型化 preload API
- IPC 请求在主进程使用 Zod schema 校验
- 图片附件通过生成的 ID 读取，不向 renderer 暴露任意文件路径
- 生产环境保持严格 Content Security Policy

## 开始使用

### 环境要求

- Windows 10/11 x64，或 macOS
- Node.js 22
- npm
- 一个支持图片输入的 OpenAI-compatible AI API

### 安装和启动

```bash
git clone https://github.com/GululuCopa/Japanese-Learning-Assistant.git
cd Japanese-Learning-Assistant
npm ci
npm run dev
```

Windows PowerShell 或 CMD 也可以执行相同的 npm 命令：

```bat
npm ci
npm run dev
```

启动后：

1. 打开“设置”。
2. 填写 AI 接口地址、模型和 API Key。
3. 选择女声或男声。
4. 确认操作系统已安装日语系统语音；可在设置页点击“测试发音”。
5. 回到“对话”。
6. 输入日语或拖入图片后发送。

AI API Key 会保存在 Electron 的应用数据目录中，不会显示在 renderer，也不会写入日志。

### AI 配置

设置页需要填写：

- AI Base URL
- AI Model
- AI API Key

接口需要兼容 OpenAI Chat Completions 风格，并且模型需要支持图片输入才能分析截图。回复语言默认为简体中文。

项目不会在 README、`.env` 或前端代码中保存真实 API Key。开发环境可以参考 `.env.example`，但正式 Key 应通过应用设置保存。

## 系统日语发音

发音使用操作系统已安装的日语系统语音，**不需要**容器、Python、本地模型下载或 TTS API Key。点击分析卡片上的 `0.75x` / `1.0x`，或设置页的「测试发音」时才会合成音频。

### macOS

1. 打开 **系统设置 → 辅助功能 → 朗读内容 → 系统声音**（或「语音」），下载日语语音。
2. 常见女声包括 Kyoko、Flo、Sandy、Shelley、Grandma；男声包括 Otoya、Eddy、Reed、Rocko、Grandpa。至少安装一种日语（`ja_JP`）语音即可。
3. 应用通过 `/usr/bin/say` 合成，再用 `/usr/bin/afconvert` 转为 WAV。

若提示未找到 macOS 日语系统语音，请先在系统设置中下载日语语音后重试。

### Windows 10/11 x64

1. 打开 **设置 → 时间和语言 → 语言和区域**，添加日语语言包。
2. 在 **设置 → 时间和语言 → 语音** 中确认已安装日语语音。
3. 应用通过 Windows PowerShell 调用 `.NET System.Speech.Synthesis` 生成 WAV。

若提示未找到 Windows 日语系统语音，请先安装日语语音包后重试。

Linux 当前不支持系统发音，会返回明确错误，不会崩溃。AI 分析在未安装日语语音时仍可使用。

## 数据位置

应用数据保存在 Electron `userData` 目录，不会写入项目目录：

### Windows

```text
%APPDATA%\Japanese Learning Assistant\japanese-assistant.sqlite
%APPDATA%\Japanese Learning Assistant\attachments\
%APPDATA%\Japanese Learning Assistant\audio-cache\
```

### macOS

```text
~/Library/Application Support/Japanese Learning Assistant/japanese-assistant.sqlite
~/Library/Application Support/Japanese Learning Assistant/attachments/
~/Library/Application Support/Japanese Learning Assistant/audio-cache/
```

如果以前安装过本地 Kokoro runtime，目录 `userData/kokoro-runtime/` 可能仍然存在。当前版本不会读取或自动删除它。确认不再需要后，可以手动删除以释放磁盘空间。

## 常用命令

| 命令                  | 说明                                                         |
| --------------------- | ------------------------------------------------------------ |
| `npm run dev`         | 启动 Electron + Vite 开发环境，并准备 Electron 的 SQLite ABI |
| `npm run lint`        | 运行 ESLint                                                  |
| `npm run format`      | 检查 Prettier 格式                                           |
| `npm run typecheck`   | 运行 TypeScript 类型检查                                     |
| `npm test -- --run`   | 准备 Node 的 SQLite ABI 并运行完整测试                       |
| `npm run build`       | 构建 main、preload 和 renderer                               |
| `npm run package:dir` | 打包当前操作系统的 unpacked 应用目录                         |
| `npm run package:win` | 构建 Windows x64 NSIS 安装包和 unpacked 目录                 |

## 测试

自动化测试使用 mock HTTP 和注入的命令执行器，不需要真实 AI API Key，也不需要联网下载语音模型：

```bash
npm ci
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

当前测试覆盖：

- PRD V0.1 核心场景
- AI provider 和结构化分析 schema
- 对话创建、发送、重试和历史加载
- Tab 切换期间的图片分析连续性
- 收藏 payload 和严格 IPC 校验
- 图片选择、保存、读取和渲染
- 系统 TTS provider（macOS say/afconvert、Windows Speech、缓存与错误提示）
- 设置安全存储和 Obsidian 导出
- Windows/macOS 路径安全与 Electron 窗口安全配置

## 打包和发布

### Windows x64

在 Windows 机器或 Windows CI 中执行：

```bat
set CSC_IDENTITY_AUTO_DISCOVERY=false
npm run package:win
```

构建结果写入 `release/`，包含 NSIS 安装程序和 unpacked 目录。当前安装包未签名，Windows SmartScreen 或杀毒软件在首次运行时可能提示风险，这是 V0.1 的预期限制。

GitHub Actions workflow：

```text
.github/workflows/windows.yml
```

会在 `windows-latest` 上执行依赖安装、lint、类型检查、测试、构建和 Windows 打包。

### macOS

```bash
npm run package:dir
```

当前构建配置支持 macOS arm64 的 unpacked 目录，未配置代码签名。

由于 `better-sqlite3` 和 Electron 存在平台差异，不建议在 macOS 上直接交叉构建 Windows 安装包；Windows 官方安装包应通过 Windows CI 或 Windows 机器生成。

## 故障排查

### 点击历史对话后没有内容

确认使用的是最新代码。当前实现会：

- 对指定历史会话重新调用 `conversations.get`。
- 在读取失败时显示错误提示。
- 防止旧的异步请求覆盖当前历史会话。

### 发音提示未找到日语系统语音

- **macOS**：在系统设置中下载日语语音后重试。
- **Windows**：在语言设置中安装日语语音包后重试。
- **Linux**：当前版本不支持系统发音。

### 发音生成超时或失败

系统语音命令可能被策略拦截、超时或返回空音频。请确认：

- macOS 上 `/usr/bin/say` 与 `/usr/bin/afconvert` 可用，并且已安装 `ja_JP` 语音。
- Windows 上 PowerShell 可用，并且已启用日语系统语音。
- 朗读文本不是空字符串。

### macOS 的 IMK/TSM 日志

以下日志通常来自 macOS 输入法或键盘服务，并不直接表示 AI 分析失败：

```text
error messaging the mach port for IMKCFRunLoopWakeUpReliable
TSM AdjustCapsLockLEDForKeyTransitionHandling
```

如模型结果确实没有返回，应同时查看应用内错误提示和主进程日志。

## 当前限制

- 需要用户提供 OpenAI-compatible AI API 和 API Key。
- 发音依赖操作系统已安装的日语系统语音；Linux 不支持。
- Windows 安装包目前未签名。
- 自动化测试不会调用真实 AI、真实 Windows 系统语音或真实 Obsidian。
- 项目当前重点是日语文本/截图理解，不包含完整的课程、复习计划或词汇统计系统。

## License

当前仓库未声明开源许可证，默认保留项目作者的全部权利。
