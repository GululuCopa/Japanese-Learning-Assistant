import { describe, expect, it } from 'vitest'
import { CONTENT_SECURITY_POLICY } from '../src/shared/constants'
import { createBrowserWindowOptions } from '../src/main/window-options'

describe('secure BrowserWindow', () => {
  it('enables isolation and disables renderer Node integration', () => {
    const options = createBrowserWindowOptions('C:\\\\app\\\\preload.js')
    expect(options.webPreferences?.contextIsolation).toBe(true)
    expect(options.webPreferences?.nodeIntegration).toBe(false)
    expect(options.webPreferences?.sandbox).toBe(true)
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'")
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval')
  })
})
