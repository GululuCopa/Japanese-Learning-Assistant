import type { AIProvider } from '@shared/contracts'
import { ProviderError } from '@shared/errors'
import { parseJapaneseAnalysis } from '@shared/schemas'
import type { AnalyzeRequest, JapaneseAnalysis, MessageRole } from '@shared/types'
import { buildAnalysisSystemPrompt, buildRepairPrompt, buildUserPrompt } from './prompt'

export interface OpenAICompatibleAIOptions {
  baseUrl: string
  apiKey: string
  model: string
  fetchImpl?: typeof fetch
}

type ChatContent =
  { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

interface ChatMessageWire {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatContent[]
}

export class OpenAICompatibleAIProvider implements AIProvider {
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: OpenAICompatibleAIOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async analyze(request: AnalyzeRequest): Promise<JapaneseAnalysis> {
    if (!this.options.baseUrl || !this.options.apiKey || !this.options.model) {
      throw new ProviderError('configuration', 'AI provider is not configured', false)
    }

    const system = buildAnalysisSystemPrompt(request.responseLanguage)
    const userText = buildUserPrompt(request)
    const userContent = buildUserContent(userText, request.images ?? [])
    const messages: ChatMessageWire[] = [
      { role: 'system', content: system },
      ...toWireContext(request.conversationContext ?? []),
      { role: 'user', content: userContent },
    ]

    const first = await this.complete(messages)
    try {
      return parseJapaneseAnalysis(first)
    } catch (error) {
      const details = error instanceof Error ? error.message : 'invalid analysis'
      const repaired = await this.complete([
        ...messages,
        { role: 'assistant', content: first },
        { role: 'user', content: buildRepairPrompt(details) },
      ])
      try {
        return parseJapaneseAnalysis(repaired)
      } catch {
        throw new ProviderError('invalid_response', 'AI 返回的内容无法解析为学习卡片', true)
      }
    }
  }

  private async complete(messages: ChatMessageWire[]): Promise<string> {
    const url = joinUrl(this.options.baseUrl, '/chat/completions')
    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages,
        }),
      })
    } catch {
      throw new ProviderError('network', '无法连接 AI 服务', true)
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError('authentication', 'AI 服务认证失败', false)
    }
    if (response.status === 429) {
      throw new ProviderError('rate_limit', 'AI 服务请求过于频繁', true)
    }
    if (!response.ok) {
      throw new ProviderError('unknown', `AI 服务返回 HTTP ${response.status}`, true)
    }

    let payload: { choices?: Array<{ message?: { content?: string | ChatContent[] } }> }
    try {
      payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | ChatContent[] } }>
      }
    } catch {
      throw new ProviderError('invalid_response', 'AI 返回的内容无法解析为学习卡片', true)
    }
    const content = payload.choices?.[0]?.message?.content
    if (typeof content === 'string') {
      return content
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('\n')
        .trim()
    }
    throw new ProviderError('invalid_response', 'AI 返回缺少内容', true)
  }
}

function buildUserContent(
  text: string,
  images: Array<{ mimeType: string; dataBase64: string }>,
): ChatContent[] {
  const parts: ChatContent[] = [{ type: 'text', text }]
  for (const image of images) {
    parts.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.dataBase64}`,
      },
    })
  }
  return parts
}

function toWireContext(context: Array<{ role: MessageRole; text: string }>): ChatMessageWire[] {
  return context.slice(-6).map((item) => ({
    role: item.role,
    content: item.text,
  }))
}

export function joinUrl(baseUrl: string, suffix: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (trimmed.endsWith('/v1') && suffix.startsWith('/')) {
    return `${trimmed}${suffix}`
  }
  if (trimmed.endsWith('/chat/completions') && suffix === '/chat/completions') {
    return trimmed
  }
  return `${trimmed}${suffix}`
}
