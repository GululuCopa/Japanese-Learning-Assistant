import { describe, expect, it } from 'vitest'
import { saveNoteSchema } from '../src/shared/schemas'
import { grammarSaveItem, vocabularySaveItem } from '../src/shared/save-payload'
import { kamauAnalysis } from './fixtures/prd-cases'

describe('note save payload', () => {
  it('strips alreadySaved so strict word/grammar save schemas accept the item', () => {
    const annotated = {
      ...kamauAnalysis.vocabulary[1]!,
      alreadySaved: true,
    }
    expect(() => saveNoteSchema.parse({ kind: 'word', item: annotated })).toThrow(/alreadySaved/)
    const stripped = vocabularySaveItem(annotated)
    expect(stripped).not.toHaveProperty('alreadySaved')
    expect(saveNoteSchema.parse({ kind: 'word', item: stripped }).kind).toBe('word')

    const grammar = { ...kamauAnalysis.grammar[0]!, alreadySaved: true }
    expect(() => saveNoteSchema.parse({ kind: 'grammar', item: grammar })).toThrow(/alreadySaved/)
    expect(saveNoteSchema.parse({ kind: 'grammar', item: grammarSaveItem(grammar) }).kind).toBe(
      'grammar',
    )
  })
})
