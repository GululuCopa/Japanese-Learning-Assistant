# Japanese Learning Assistant

> 基于真实日语内容的 AI 学习助手

## 1. 产品概述

Japanese Learning Assistant 是一个面向真实日语使用场景的 AI 辅助学习工具。

用户在玩游戏、看漫画、浏览网页、阅读聊天内容时，经常会遇到：

* 不认识的汉字
* 不知道读音的单词
* 看得懂单词但看不懂整句话
* 不理解句子的语气和隐含含义
* 想知道某句话怎样自然地用日语表达
* 查过一个词，但过几天再次遇到时已经忘记
* 想把有价值的内容保存到自己的 Note / Obsidian

本产品的目标不是替代传统教材，也不是制作一个 JLPT 刷题软件。

核心目标是：

> 将用户在真实内容中遇到的日语，快速转化为可以理解、可以听、可以保存、可以再次学习的个人知识。

核心工作流：

```text
遇到日语
  ↓
截图 / 粘贴文本 / 提问
  ↓
AI 理解
  ↓
读音 + 翻译 + 单词 + 语法 + 语境解释
  ↓
发音
  ↓
收藏
  ↓
Note / Obsidian
  ↓
逐渐形成“我的日语”
```

---

# 2. 产品定位

## 2.1 产品定义

一句话定义：

> 一款基于真实日语内容的 AI 学习助手，用户可以通过截图、文本或自然语言提问即时理解日语的读音、词义、语法和语境，并将有价值的词句沉淀到个人知识库中。

关键词：

* Chat First
* Multimodal
* Context Aware
* Learning Oriented
* Personal Knowledge Base

---

# 3. 产品原则

## 3.1 Chat First

所有核心能力围绕一个统一对话框展开。

用户不应该考虑：

* 我要进入 OCR 页面
* 我要进入翻译页面
* 我要进入词典页面
* 我要进入语法页面

用户只需要：

```text
粘贴内容
+
直接提问
```

例如：

```text
[游戏截图]

这句话什么意思？
```

```text
生意気

这个怎么念？
```

```text
仕方ない 和 しょうがない 有什么区别？
```

```text
“今天真的不想上班”

用日语怎么说自然一点？
```

AI 自动判断意图。

---

## 3.2 Context First

日语解释不能只提供机械翻译。

例如：

```text
俺に構うな
```

不能只返回：

```text
别管我
```

还应该解释：

* 俺：男性化、较粗犷的第一人称
* 構う：理会、管、在意
* 構うな：禁止表达
* 整句话的语气偏冷淡、拒绝
* 不适合正式场景

学习目标是：

> 理解“为什么这里这么说”。

而不仅仅是：

> 得到中文意思。

---

## 3.3 Learning over Translation

产品不是翻译器。

所有解析都应该优先考虑学习价值。

默认回答至少考虑：

1. 原文
2. 假名
3. 中文含义
4. 关键词
5. 文法
6. 语气
7. 使用场景
8. 必要的例句

---

## 3.4 Low Friction

用户正在玩游戏时，不应该为了查一句话中断五分钟。

理想过程：

```text
截图
Ctrl + V
“这啥意思”
Enter
```

数秒后得到结果。

因此：

* 不要求手动裁剪
* 不要求手动 OCR
* 不要求选择语言
* 不要求填写分类
* 不要求先创建学习计划

---

# 4. 目标用户

初期目标用户：

* 日语初学者
* 有一定基础但阅读真实内容困难的人
* 游戏玩家
* 动漫 / 漫画用户
* 经常消费日语内容的人
* 使用 Obsidian / Markdown 建立个人知识库的人

初期产品优先服务：

> “能够看懂一点，但经常卡在词汇、读音和表达上的学习者。”

暂时不针对：

* 专业日语翻译
* 日语语言学研究
* 专业 JLPT 应试
* 日语教师教学管理

---

# 5. 核心使用场景

## 场景 A：游戏截图

用户截图：

```text
そんなの俺には関係ない。
```

输入：

```text
[截图]

这句话什么意思？
```

系统返回：

```text
そんなの俺には関係ない。

そんなの おれには かんけいない。

那种事情跟我没关系。

关键词：

俺
おれ
我

比较男性化、口语化。

関係
かんけい
关系

「～には関係ない」
与……没有关系。

语气：

偏冷淡、直接。
```

用户可以：

* 播放整句
* 播放单词
* 收藏句子
* 收藏单词
* 保存到 Obsidian

---

# 6. V0.1 范围

V0.1 的目标：

> 完成“遇见日语 → 理解 → 发音 → 收藏 → 保存”的完整闭环。

---

# 7. V0.1 功能需求

## 7.1 Conversation

提供一个统一聊天界面。

支持：

### 文本输入

支持：

* 日语
* 中文
* 中日混合
* 自然语言问题

例如：

```text
構う是什么意思
```

```text
这个词怎么念：生意気
```

---

### 图片输入

支持：

* Clipboard 粘贴
* 拖拽图片
* 文件选择

主要用途：

* 游戏截图
* 漫画截图
* 网页截图
* 字幕截图

MVP 不单独实现 OCR 服务。

流程：

```text
Image
 ↓
Multimodal LLM
 ↓
Text Understanding
```

---

## 7.2 Japanese Analysis

AI 应提供结构化分析。

至少包含：

### Original

原始日语。

### Reading

整句话假名。

例如：

```text
そんなの おれには かんけいない
```

### Translation

自然中文翻译。

### Literal Translation

必要时提供字面解释。

### Vocabulary

识别值得学习的词。

例如：

```json
{
  "surface": "関係",
  "reading": "かんけい",
  "meaning": "关系",
  "partOfSpeech": "名词"
}
```

### Grammar

识别有学习价值的文法。

### Tone

例如：

* 正式
* 普通
* 随意
* 粗鲁
* 男性化
* 女性化
* 网络用语
* 古典表达

### Context

解释该表达在当前上下文为什么这样使用。

---

# 8. Structured Output

LLM 不应该直接作为 UI 数据源输出任意 Markdown。

模型统一返回结构化数据。

建议 Schema：

```typescript
interface JapaneseAnalysis {
  original: string

  reading?: string

  translation: string

  literalTranslation?: string

  explanation?: string

  vocabulary: VocabularyItem[]

  grammar: GrammarItem[]

  tone?: ToneInfo

  learningPoints?: LearningPoint[]
}
```

Vocabulary：

```typescript
interface VocabularyItem {
  surface: string

  lemma?: string

  reading: string

  romaji?: string

  meaning: string[]

  partOfSpeech?: string

  explanation?: string

  example?: ExampleSentence

  recommendedToSave?: boolean
}
```

Grammar：

```typescript
interface GrammarItem {
  pattern: string

  meaning: string

  explanation: string

  example?: ExampleSentence
}
```

Example：

```typescript
interface ExampleSentence {
  text: string

  reading?: string

  translation: string
}
```

Tone：

```typescript
interface ToneInfo {
  register?:
    | "formal"
    | "neutral"
    | "casual"
    | "rough"

  genderStyle?:
    | "neutral"
    | "masculine"
    | "feminine"

  description?: string
}
```

---

# 9. UI 设计

主界面采用聊天式布局。

```text
┌──────────────────────────────────┐
│ Japanese Assistant               │
├───────────┬──────────────────────┤
│ History   │ Conversation         │
│           │                      │
│           │ User                 │
│           │ [Screenshot]         │
│           │ 这句话什么意思？     │
│           │                      │
│           │ Assistant            │
│           │                      │
│           │ 原文                 │
│           │ 读音                 │
│           │ 🔊                   │
│           │                      │
│           │ 翻译                 │
│           │                      │
│           │ Vocabulary           │
│           │ Grammar              │
│           │ Context              │
│           │                      │
│           │ ☆ 收藏               │
│           │                      │
├───────────┴──────────────────────┤
│ [ + ] Ask something...           │
└──────────────────────────────────┘
```

---

# 10. Analysis Card

AI 回答不要只显示 Markdown。

应该存在结构化卡片。

例如：

```text
俺には関係ない

おれには かんけいない

🔊 0.75x   🔊 1.0x

跟我没关系。

──────────────────

俺
おれ

我

男性常用，语气比「私」更随意。

[☆ 收藏]

──────────────────

関係ない
かんけいない

没有关系

「Aには関係ない」
表示“A与此无关”。

[☆ 收藏]

──────────────────

语气

比较直接、冷淡。
```

---

# 11. 发音

TTS 独立于 LLM。

架构：

```text
LLM
 ↓
Japanese Text
 ↓
TTS Provider
 ↓
Audio
```

支持：

### 单词播放

例如：

```text
構う
🔊
```

### 整句播放

```text
俺には関係ない
🔊
```

### 播放速度

至少：

```text
0.75x
1.0x
```

未来可以支持：

```text
0.5x
0.75x
1.0x
1.25x
```

---

# 12. Note 系统

用户可以收藏：

* 单词
* 句子
* 文法

---

## Word Note

例如：

```yaml
type: word

term: 構う

reading: かまう

meaning:
  - 理会
  - 管
  - 在意

source:
  type: game
  title: Persona 5

originalSentence: 俺に構うな

translation: 别管我

tags:
  - verb
  - game

createdAt: 2026-08-31
```

---

## Sentence Note

```yaml
type: sentence

text: 俺に構うな

reading: おれに かまうな

translation: 别管我

source:
  type: game

createdAt: 2026-08-31
```

---

## Grammar Note

```yaml
type: grammar

pattern: ～な

meaning: 不要……

example:

  text: 俺に構うな

  translation: 别管我
```

---

# 13. Obsidian 集成

Obsidian 是第一优先级外部知识库。

用户配置：

```text
Vault Path
```

例如：

```text
D:\Obsidian\MyVault
```

应用写入：

```text
MyVault/

Japanese/

  Words/

  Sentences/

  Grammar/

  Assets/
```

---

## Word Markdown

示例：

```markdown
---
type: japanese-word
reading: かまう
created: 2026-08-31
tags:
  - japanese
  - verb
---

# 構う

## Reading

かまう

## Meaning

理会、管、在意。

## Context

> 俺に構うな。

おれに かまうな。

别管我。

## Explanation

「構う」表示对某人或某件事情给予注意、干涉或理会。

「構うな」属于禁止表达：

> 不要管。
```

---

# 14. Screenshot 保存

收藏内容允许关联原始截图。

例如：

```text
Japanese/
Assets/

2026-08-31-xxxx.png
```

Note：

```markdown
## Source

![[../Assets/2026-08-31-xxxx.png]]
```

截图上下文属于学习内容的一部分。

它能够帮助用户通过场景重新建立记忆。

---

# 15. AI 推荐收藏

AI 可以判断：

```json
{
  "recommendedToSave": true
}
```

UI 显示：

```text
⭐ 推荐收藏
```

但是：

> 不自动收藏。

用户必须确认。

避免一次截图生成十几个无意义词条。

---

# 16. Conversation History

保存对话历史。

Conversation：

```typescript
interface Conversation {
  id: string

  title: string

  createdAt: Date

  updatedAt: Date
}
```

Message：

```typescript
interface Message {
  id: string

  conversationId: string

  role: "user" | "assistant"

  content: MessageContent[]

  createdAt: Date
}
```

---

# 17. Storage

V0.1 推荐：

```text
SQLite
```

本地存储：

```text
SQLite
├── conversation
├── message
├── vocabulary
├── sentence
├── grammar
├── note
└── attachment
```

应用负责管理内部数据。

Obsidian：

```text
Application Database
        ↓
     Export
        ↓
     Markdown
        ↓
     Obsidian
```

初期不要把 Obsidian 当数据库。

---

# 18. AI Provider 抽象

不要绑定单一模型。

定义：

```typescript
interface AIProvider {

  analyze(
    request: AnalyzeRequest
  ): Promise<JapaneseAnalysis>

}
```

Request：

```typescript
interface AnalyzeRequest {

  text?: string

  images?: ImageAttachment[]

  conversationContext?: Message[]

}
```

可以支持：

```text
OpenAI
Gemini
Claude
OpenRouter
Custom OpenAI Compatible API
```

V0.1 可以只实现一个 Provider。

但接口必须抽象。

---

# 19. TTS Provider

同理：

```typescript
interface TTSProvider {

  speak(
    text: string,
    options?: TTSOptions
  ): Promise<AudioResult>

}
```

未来可以切换：

* OpenAI TTS
* Azure
* Google
* ElevenLabs
* 本地 TTS

---

# 20. 数据模型

核心 Entity：

```text
Conversation

Message

Attachment

Vocabulary

Sentence

Grammar

Source

Note
```

建议关系：

```text
Conversation
    │
    └── Message
           │
           ├── Attachment
           │
           └── JapaneseAnalysis
                     │
                     ├── Vocabulary
                     ├── Sentence
                     └── Grammar
```

收藏之后：

```text
JapaneseAnalysis
       ↓
      Note
```

---

# 21. Source

Source 非常重要。

所有学习内容尽量保存来源。

```typescript
interface Source {

  type:
    | "game"
    | "anime"
    | "manga"
    | "web"
    | "chat"
    | "manual"

  title?: string

  url?: string

  screenshotId?: string
}
```

以后可以出现：

```text
Persona 5

Vocabulary: 284

Sentences: 117
```

---

# 22. V0.1 页面

V0.1 控制在四个页面。

## Chat

核心页面。

功能：

* 新建 Conversation
* 输入文本
* 上传 / 粘贴图片
* 查看 AI 分析
* 播放语音
* 收藏

---

## Notes

查看：

```text
Words
Sentences
Grammar
```

支持：

* 搜索
* 查看
* 删除
* 导出

---

## History

查看历史 Conversation。

---

## Settings

配置：

```text
AI Provider

API Key

Model

TTS Provider

Obsidian Vault Path

Language
```

---

# 23. V0.1 明确不做

以下功能暂时禁止进入 V0.1：

* 登录
* 注册
* 云同步
* 社交
* 排行榜
* 积分
* 连续学习天数
* JLPT 题库
* AI 虚拟角色
* 完整课程
* 教师系统
* OCR Pipeline
* Anki
* SRS
* 生词掌握度算法
* 学习统计
* 学习计划
* 多设备同步
* 浏览器插件
* 手机 App

原则：

> 任何不能直接提高“查询 → 理解 → 收藏”体验的功能，都推迟。

---

# 24. V0.2

V0.2 开始强化学习属性。

## Lemma 聚合

例如：

```text
構う

構わない

構うな

構って
```

聚合为：

```text
構う
```

用户可以看到：

```text
Encountered: 7
```

---

## Encounter Count

每次 AI 分析出现已有词汇：

```text
encounterCount += 1
```

例如：

```text
構う

遇见：5 次

查询：3 次
```

---

## Repeated Difficulty

如果用户反复查询：

```text
わけ
```

系统识别：

> 用户可能尚未掌握。

---

# 25. V0.3：我的日语

建立 Personal Japanese Corpus。

Dashboard：

```text
最近 30 天

阅读句子
824

独立词汇
611

重复遇见
183

收藏
137

────────────────

最近高频：

わけ        12
ように       9
仕方ない     8
構う         7

────────────────

反复查询：

わけ
はず
ことになる

────────────────

建议学习：

「わけ」相关表达
```

产品学习路线逐渐从：

```text
JLPT 标准课程
```

变为：

```text
用户真实遇到的内容
```

---

# 26. 长期方向

长期产品可以形成：

```text
Personal Japanese Dataset
        ↓
Knowledge Graph
        ↓
Learning Model
        ↓
Personal Learning Plan
```

系统逐渐知道：

* 用户认识哪些词
* 用户经常遇见哪些词
* 用户总忘记哪些词
* 用户经常读什么类型内容
* 用户偏好的表达
* 用户容易卡在哪些文法

最终：

> 软件不是告诉用户“现在应该学习 N3 Lesson 12”。

而是告诉用户：

> 最近你玩的游戏里连续出现了 9 次「わけ」，而且你查询了 4 次。现在值得花 10 分钟彻底搞懂它。

---

# 27. 推荐技术架构

整体：

```text
Desktop Client
      │
      ▼
Application
      │
      ├── Conversation Service
      │
      ├── AI Service
      │
      ├── TTS Service
      │
      ├── Note Service
      │
      └── Obsidian Service
      │
      ▼
    SQLite
```

AI：

```text
AI Service
     │
AIProvider
     │
     ├── OpenAI
     ├── Gemini
     ├── Claude
     └── Compatible API
```

TTS：

```text
TTS Service
      │
TTSProvider
      │
      ├── OpenAI
      ├── Azure
      └── Local
```

---

# 28. 推荐项目目录

具体语言可以调整，但逻辑结构建议保持：

```text
app/

├── conversation/
│   ├── domain
│   ├── service
│   └── repository
│
├── ai/
│   ├── provider
│   ├── prompt
│   ├── schema
│   └── service
│
├── learning/
│   ├── vocabulary
│   ├── sentence
│   └── grammar
│
├── tts/
│   ├── provider
│   └── service
│
├── note/
│   ├── domain
│   ├── template
│   └── service
│
├── obsidian/
│   └── service
│
├── storage/
│
└── ui/
```

---

# 29. 开发优先级

## Phase 1

先打通：

```text
Text
 ↓
LLM
 ↓
Structured Output
 ↓
UI
```

验收：

输入：

```text
俺に構うな
```

能够稳定输出：

* reading
* translation
* vocabulary
* grammar
* tone

---

## Phase 2

加入图片。

```text
Clipboard
 ↓
Image
 ↓
Multimodal Model
 ↓
JapaneseAnalysis
```

---

## Phase 3

加入 TTS。

---

## Phase 4

加入 Note。

---

## Phase 5

加入 Obsidian。

做到这里：

> V0.1 完成。

---

# 30. V0.1 Definition of Done

满足以下场景即认为 V0.1 可用：

### Case 1

用户输入：

```text
生意気怎么念？
```

系统正确返回：

```text
生意気
なまいき
```

并可以播放日语发音。

---

### Case 2

用户粘贴游戏截图：

```text
俺に構うな
```

系统能够：

* 读取截图内容
* 返回日文
* 标注假名
* 翻译
* 分析词汇
* 分析语法
* 描述语气

---

### Case 3

用户点击：

```text
收藏 構う
```

Notes 页面出现：

```text
構う
かまう
理会 / 管 / 在意
```

---

### Case 4

用户点击：

```text
Export to Obsidian
```

Vault 中正确生成：

```text
Japanese/Words/構う.md
```

---

### Case 5

用户再次输入：

```text
構う
```

系统能够识别该词已经收藏。

---

# 31. 核心成功指标

V0.1 不需要复杂数据指标。

只需要回答三个问题：

### 1.

遇见一句不会的日语，从截图到得到解释是否足够快？

### 2.

解释是否比普通翻译更有学习价值？

### 3.

遇见一个值得记忆的内容，能否在一次点击内进入个人知识库？

如果三个答案都是：

```text
Yes
```

产品成立。

---

# 32. 产品最终愿景

Traditional Learning：

```text
教材
 ↓
今天应该学什么
 ↓
记忆
 ↓
等待以后遇见
```

Japanese Learning Assistant：

```text
真实内容
 ↓
遇见
 ↓
理解
 ↓
记录
 ↓
再次遇见
 ↓
掌握
```

核心理念：

> Learn Japanese from what you actually encounter.

不是为了学习而制造内容。

而是把真实生活中已经遇见的日语，转化成学习。
