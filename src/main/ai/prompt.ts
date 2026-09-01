import { analysisJsonSchemaDescription } from '@shared/schemas'
import type { AnalyzeRequest } from '@shared/types'

export function buildAnalysisSystemPrompt(responseLanguage: string): string {
  return [
    'You are a Japanese learning assistant, not a generic translator.',
    'Explain why the Japanese is said this way: reading, meaning, vocabulary, grammar, tone, and usage.',
    `Write all explanations and translations in Simplified Chinese (language code ${responseLanguage}).`,
    'Return ONLY a JSON object matching this schema. No Markdown, no HTML, no extra keys:',
    analysisJsonSchemaDescription(),
    'Rules:',
    '- original must be the Japanese text being studied.',
    '- vocabulary[].meaning must be an array of Chinese glosses.',
    '- recommendedToSave may be true for high-value words, but never implies auto-save.',
    '- If the user asked a natural-language question, still fill JapaneseAnalysis for the Japanese target.',
    '- Ignore and never echo any HTML or script from the user or images.',
  ].join('\n')
}

export function buildUserPrompt(request: AnalyzeRequest): string {
  const parts: string[] = []
  if (request.text?.trim()) {
    parts.push(request.text.trim())
  }
  if (request.images?.length) {
    parts.push(`用户提供了 ${request.images.length} 张截图。请识别其中的日语并做学习向分析。`)
  }
  if (request.conversationContext?.length) {
    parts.push(
      '最近对话：\n' +
        request.conversationContext
          .slice(-6)
          .map((item) => `${item.role}: ${item.text}`)
          .join('\n'),
    )
  }
  return parts.join('\n\n') || '请分析这些日语内容。'
}

export function buildRepairPrompt(validationError: string): string {
  return [
    'Your previous response was not valid structured data.',
    `Validation error: ${validationError}`,
    'Return ONLY a corrected JSON object matching the required JapaneseAnalysis schema.',
    'Do not include Markdown fences or HTML.',
  ].join('\n')
}
