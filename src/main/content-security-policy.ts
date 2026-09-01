import { CONTENT_SECURITY_POLICY } from '@shared/constants'

const LOCAL_VITE_HTTP = 'http://localhost:* http://127.0.0.1:*'
const LOCAL_VITE_WS = 'ws://localhost:* ws://127.0.0.1:*'

export function cspDirectiveNames(policy: string): string[] {
  return policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+/)[0] ?? '')
    .filter(Boolean)
}

export function buildContentSecurityPolicy(development: boolean): string {
  const directives = new Map<string, string>()
  for (const part of CONTENT_SECURITY_POLICY.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [name, ...values] = trimmed.split(/\s+/)
    if (!name) continue
    directives.set(name, values.join(' '))
  }

  if (development) {
    directives.set('script-src', `'self' 'unsafe-eval' 'unsafe-inline' ${LOCAL_VITE_HTTP}`)
    directives.set('style-src', `'self' 'unsafe-inline' ${LOCAL_VITE_HTTP}`)
    directives.set('connect-src', `'self' ${LOCAL_VITE_HTTP} ${LOCAL_VITE_WS}`)
  }

  return [...directives.entries()].map(([name, value]) => `${name} ${value}`.trim()).join('; ')
}
