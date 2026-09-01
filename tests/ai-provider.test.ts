import { describe, expect, it, vi } from 'vitest'
import { ProviderError } from '../src/shared/errors'
import { OpenAICompatibleAIProvider } from '../src/main/ai/openai-compatible'
import { kamauAnalysis, namaikiAnalysis } from './fixtures/prd-cases'

describe('OpenAI-compatible AI provider', () => {
  it('shapes a multimodal request and parses structured output', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: unknown }>
      }
      expect(init?.headers).toMatchObject({ authorization: 'Bearer sk-test' })
      expect(JSON.stringify(body.messages)).toContain('data:image/png;base64,abc')
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(kamauAnalysis) } }] }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    }) as unknown as typeof fetch

    const provider = new OpenAICompatibleAIProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'sk-test',
      model: 'gpt-test',
      fetchImpl,
    })
    const result = await provider.analyze({
      text: '俺に構うな',
      images: [{ mimeType: 'image/png', dataBase64: 'abc' }],
      responseLanguage: 'zh-CN',
    })
    expect(result.original).toBe('俺に構うな')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('makes one bounded repair attempt for malformed data', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"nope":true}' } }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify(namaikiAnalysis) } }] }),
          {
            status: 200,
          },
        ),
      ) as unknown as typeof fetch

    const provider = new OpenAICompatibleAIProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'sk-test',
      model: 'gpt-test',
      fetchImpl,
    })
    const result = await provider.analyze({ text: '生意気怎么念？', responseLanguage: 'zh-CN' })
    expect(result.reading).toBe('なまいき')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('categorizes a successful HTTP response with a non-JSON body as invalid_response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('not-json {', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
    ) as unknown as typeof fetch
    const provider = new OpenAICompatibleAIProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'sk-test',
      model: 'gpt-test',
      fetchImpl,
    })
    await expect(provider.analyze({ text: 'x', responseLanguage: 'zh-CN' })).rejects.toMatchObject({
      code: 'invalid_response',
    } satisfies Partial<ProviderError>)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('categorizes authentication failures', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('nope', { status: 401 }),
    ) as unknown as typeof fetch
    const provider = new OpenAICompatibleAIProvider({
      baseUrl: 'https://example.test/v1',
      apiKey: 'bad',
      model: 'gpt-test',
      fetchImpl,
    })
    await expect(provider.analyze({ text: 'x', responseLanguage: 'zh-CN' })).rejects.toMatchObject({
      code: 'authentication',
    } satisfies Partial<ProviderError>)
  })
})
