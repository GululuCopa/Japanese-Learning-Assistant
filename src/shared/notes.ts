import type { GrammarItem, NoteKind, VocabularyItem } from './types'

export function normalizeDuplicateKey(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

export function wordDuplicateKey(item: Pick<VocabularyItem, 'lemma' | 'surface'>): string {
  return normalizeDuplicateKey(item.lemma || item.surface)
}

export function sentenceDuplicateKey(original: string): string {
  return normalizeDuplicateKey(original)
}

export function grammarDuplicateKey(item: Pick<GrammarItem, 'pattern'>): string {
  return normalizeDuplicateKey(item.pattern)
}

export function duplicateKeyFor(kind: NoteKind, value: string): string {
  return `${kind}:${normalizeDuplicateKey(value)}`
}
