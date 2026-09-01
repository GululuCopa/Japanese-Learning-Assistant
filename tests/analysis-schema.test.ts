import { describe, expect, it } from 'vitest'
import { parseJapaneseAnalysis } from '../src/shared/schemas'
import { kamauAnalysis } from './fixtures/prd-cases'

describe('Japanese analysis schema', () => {
  it('accepts a complete learning-oriented analysis', () => {
    const parsed = parseJapaneseAnalysis(kamauAnalysis)
    expect(parsed.original).toBe('俺に構うな')
    expect(parsed.reading).toBe('おれに かまうな')
    expect(parsed.translation).toBe('别管我')
    expect(parsed.vocabulary[1]?.surface).toBe('構う')
    expect(parsed.grammar[0]?.pattern).toBe('～な')
    expect(parsed.tone?.description).toContain('冷淡')
  })

  it('normalizes missing arrays and rejects HTML-only payloads', () => {
    const parsed = parseJapaneseAnalysis({
      original: '生意気',
      translation: '傲慢',
    })
    expect(parsed.vocabulary).toEqual([])
    expect(parsed.grammar).toEqual([])
    expect(parsed.learningPoints).toEqual([])
    expect(() => parseJapaneseAnalysis('<script>alert(1)</script>')).toThrow()
    expect(() => parseJapaneseAnalysis({ original: 'x', translation: 'y', extra: true })).toThrow()
  })

  it('parses JSON that was wrapped in Markdown fences', () => {
    const parsed = parseJapaneseAnalysis(
      '```json\n{"original":"生意気","reading":"なまいき","translation":"傲慢","vocabulary":[],"grammar":[]}\n```',
    )
    expect(parsed.reading).toBe('なまいき')
  })
})
