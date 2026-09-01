import { grammarDuplicateKey, sentenceDuplicateKey, wordDuplicateKey } from '@shared/notes'
import type { JapaneseAnalysis } from '@shared/types'
import type { AppRepositories } from '../database/repositories'

export function annotateAnalysis(
  analysis: JapaneseAnalysis,
  repos: AppRepositories,
): JapaneseAnalysis {
  const words = repos.savedWordKeys()
  const sentences = repos.savedSentenceKeys()
  const grammar = repos.savedGrammarKeys()
  return {
    ...analysis,
    sentenceAlreadySaved: sentences.has(sentenceDuplicateKey(analysis.original)),
    vocabulary: analysis.vocabulary.map((item) => ({
      ...item,
      alreadySaved: words.has(wordDuplicateKey(item)),
    })),
    grammar: analysis.grammar.map((item) => ({
      ...item,
      alreadySaved: grammar.has(grammarDuplicateKey(item)),
    })),
  }
}
