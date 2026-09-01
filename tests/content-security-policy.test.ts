import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy, cspDirectiveNames } from '../src/main/content-security-policy'

function expectUniqueDirectives(policy: string): string[] {
  const names = cspDirectiveNames(policy)
  expect(names).toEqual([...new Set(names)])
  return names
}

describe('Content-Security-Policy builder', () => {
  it('keeps a strict production policy with each directive once and no Vite allowances', () => {
    const policy = buildContentSecurityPolicy(false)
    const names = expectUniqueDirectives(policy)
    expect(names).toContain('script-src')
    expect(names).toContain('style-src')
    expect(names).toContain('connect-src')
    expect(policy).toContain("script-src 'self'")
    expect(policy).not.toMatch(/unsafe-eval|unsafe-inline|localhost|127\.0\.0\.1/)
  })

  it('uses one development policy with local Vite/HMR allowances and no duplicate names', () => {
    const policy = buildContentSecurityPolicy(true)
    expectUniqueDirectives(policy)
    expect(policy).toMatch(/script-src [^;]*'unsafe-eval'/)
    expect(policy).toMatch(/script-src [^;]*'unsafe-inline'/)
    expect(policy).toMatch(/script-src [^;]*http:\/\/localhost:\*/)
    expect(policy).toMatch(/style-src [^;]*'unsafe-inline'/)
    expect(policy).toMatch(/connect-src [^;]*ws:\/\/localhost:\*/)
    expect(policy).toMatch(/connect-src [^;]*http:\/\/localhost:\*/)
    expect(policy).not.toMatch(/https?:\/\/(?!localhost|127\.0\.0\.1)[^\s;]+/)
  })
})
