import type { GrammarItem, VocabularyItem } from './types'

export function vocabularySaveItem(item: VocabularyItem): VocabularyItem {
  return {
    surface: item.surface,
    lemma: item.lemma,
    reading: item.reading,
    romaji: item.romaji,
    meaning: item.meaning,
    partOfSpeech: item.partOfSpeech,
    explanation: item.explanation,
    example: item.example,
    recommendedToSave: item.recommendedToSave,
  }
}

export function grammarSaveItem(item: GrammarItem): GrammarItem {
  return {
    pattern: item.pattern,
    meaning: item.meaning,
    explanation: item.explanation,
    example: item.example,
  }
}
