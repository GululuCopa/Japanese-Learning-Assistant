export const PROVIDER_ERROR_CODES = [
  'configuration',
  'authentication',
  'rate_limit',
  'network',
  'invalid_response',
  'unknown',
] as const

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number]

export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  readonly retryable: boolean

  constructor(code: ProviderErrorCode, message: string, retryable = isRetryable(code)) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
    this.retryable = retryable
  }
}

export function isRetryable(code: ProviderErrorCode): boolean {
  return (
    code === 'network' || code === 'rate_limit' || code === 'invalid_response' || code === 'unknown'
  )
}

export function toErrorPayload(error: unknown): {
  code: ProviderErrorCode
  message: string
  retryable: boolean
} {
  if (error instanceof ProviderError) {
    return { code: error.code, message: error.message, retryable: error.retryable }
  }
  if (error instanceof Error) {
    return { code: 'unknown', message: error.message, retryable: true }
  }
  return { code: 'unknown', message: '发生未知错误', retryable: true }
}

export function userFacingProviderMessage(code: ProviderErrorCode, fallback: string): string {
  switch (code) {
    case 'configuration':
      return '请先在设置中填写 AI 接口地址、模型和 API Key。'
    case 'authentication':
      return 'AI 服务认证失败，请检查 API Key 是否正确。'
    case 'rate_limit':
      return 'AI 服务请求过于频繁，请稍后再试。'
    case 'network':
      return '无法连接 AI 服务，请检查网络和接口地址。'
    case 'invalid_response':
      return 'AI 返回的内容无法解析为学习卡片，请重试。'
    default:
      return fallback || '分析失败，请重试。'
  }
}
