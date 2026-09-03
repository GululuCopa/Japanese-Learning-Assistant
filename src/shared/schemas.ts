import { z } from 'zod'
import { ALLOWED_IMAGE_MIME, MAX_IMAGE_BYTES, MAX_IMAGES_PER_MESSAGE } from './constants'
import type { JapaneseAnalysis } from './types'

const exampleSentenceSchema = z
  .object({
    text: z.string().min(1),
    reading: z.string().min(1).optional(),
    translation: z.string().min(1),
  })
  .strict()

const vocabularyItemSchema = z
  .object({
    surface: z.string().min(1),
    lemma: z.string().min(1).optional(),
    reading: z.string().min(1),
    romaji: z.string().min(1).optional(),
    meaning: z.array(z.string().min(1)).min(1),
    partOfSpeech: z.string().min(1).optional(),
    explanation: z.string().min(1).optional(),
    example: exampleSentenceSchema.optional(),
    recommendedToSave: z.boolean().optional(),
  })
  .strict()

const grammarItemSchema = z
  .object({
    pattern: z.string().min(1),
    meaning: z.string().min(1),
    explanation: z.string().min(1),
    example: exampleSentenceSchema.optional(),
  })
  .strict()

const toneInfoSchema = z
  .object({
    register: z.enum(['formal', 'neutral', 'casual', 'rough']).optional(),
    genderStyle: z.enum(['neutral', 'masculine', 'feminine']).optional(),
    description: z.string().min(1).optional(),
  })
  .strict()

const learningPointSchema = z
  .object({
    title: z.string().min(1).optional(),
    text: z.string().min(1),
  })
  .strict()

export const japaneseAnalysisSchema = z
  .object({
    original: z.string().min(1),
    reading: z.string().min(1).optional(),
    translation: z.string().min(1),
    literalTranslation: z.string().min(1).optional(),
    explanation: z.string().min(1).optional(),
    vocabulary: z.array(vocabularyItemSchema).default([]),
    grammar: z.array(grammarItemSchema).default([]),
    tone: toneInfoSchema.optional(),
    learningPoints: z.array(learningPointSchema).default([]),
  })
  .strict()

export const stagedImageSchema = z.object({
  name: z.string(),
  mimeType: z.enum(ALLOWED_IMAGE_MIME),
  byteSize: z.number().int().positive().max(MAX_IMAGE_BYTES),
  dataBase64: z.string().min(1),
})

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string(),
  images: z.array(stagedImageSchema).max(MAX_IMAGES_PER_MESSAGE).default([]),
})

export const retryMessageSchema = z.object({
  messageId: z.string().min(1),
})

export const listNotesSchema = z.object({
  kind: z.enum(['word', 'sentence', 'grammar']),
  query: z.string().optional(),
})

export const saveNoteSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('word'),
    conversationId: z.string().optional(),
    messageId: z.string().optional(),
    item: vocabularyItemSchema,
    originalSentence: z.string().optional(),
    translation: z.string().optional(),
    screenshotAttachmentId: z.string().optional(),
    source: z
      .object({
        type: z.enum(['game', 'anime', 'manga', 'web', 'chat', 'manual']),
        title: z.string().optional(),
        url: z.string().optional(),
        screenshotId: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal('sentence'),
    conversationId: z.string().optional(),
    messageId: z.string().optional(),
    original: z.string().min(1),
    reading: z.string().optional(),
    translation: z.string().min(1),
    screenshotAttachmentId: z.string().optional(),
    source: z
      .object({
        type: z.enum(['game', 'anime', 'manga', 'web', 'chat', 'manual']),
        title: z.string().optional(),
        url: z.string().optional(),
        screenshotId: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal('grammar'),
    conversationId: z.string().optional(),
    messageId: z.string().optional(),
    item: grammarItemSchema,
    originalSentence: z.string().optional(),
    translation: z.string().optional(),
    screenshotAttachmentId: z.string().optional(),
    source: z
      .object({
        type: z.enum(['game', 'anime', 'manga', 'web', 'chat', 'manual']),
        title: z.string().optional(),
        url: z.string().optional(),
        screenshotId: z.string().optional(),
      })
      .optional(),
  }),
])

export const settingsUpdateSchema = z.object({
  aiBaseUrl: z.string(),
  aiModel: z.string(),
  aiApiKey: z.string().optional(),
  voiceGender: z.enum(['female', 'male']),
  ttsProvider: z.enum(['system', 'minimax']),
  minimaxRegion: z.enum(['china', 'global']),
  minimaxModel: z.string(),
  minimaxFemaleVoice: z.string(),
  minimaxMaleVoice: z.string(),
  minimaxApiKey: z.string().optional(),
  obsidianVaultPath: z.string(),
  responseLanguage: z.literal('zh-CN'),
  clearAiApiKey: z.boolean().optional(),
  clearMinimaxApiKey: z.boolean().optional(),
})

export const speakInputSchema = z.object({
  text: z.string().min(1),
  speed: z.union([z.literal(0.75), z.literal(1)]),
  voiceGender: z.enum(['female', 'male']).optional(),
})

export const idSchema = z.object({
  id: z.string().min(1),
})

export const attachmentReadSchema = z.object({
  id: z.string().min(1),
})

function unwrapJsonCandidate(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1] : trimmed
  try {
    return JSON.parse(body)
  } catch {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(body.slice(start, end + 1))
    }
    throw new Error('Response was not valid JSON')
  }
}

export function parseJapaneseAnalysis(input: unknown): JapaneseAnalysis {
  const candidate = typeof input === 'string' ? unwrapJsonCandidate(input) : input
  const parsed = japaneseAnalysisSchema.parse(candidate)
  return {
    original: parsed.original,
    reading: parsed.reading,
    translation: parsed.translation,
    literalTranslation: parsed.literalTranslation,
    explanation: parsed.explanation,
    vocabulary: parsed.vocabulary.map((item) => ({
      ...item,
      meaning: item.meaning,
    })),
    grammar: parsed.grammar,
    tone: parsed.tone,
    learningPoints: parsed.learningPoints,
  }
}

export function analysisJsonSchemaDescription(): string {
  return JSON.stringify(
    {
      original: 'string',
      reading: 'string?',
      translation: 'string',
      literalTranslation: 'string?',
      explanation: 'string?',
      vocabulary: [
        {
          surface: 'string',
          lemma: 'string?',
          reading: 'string',
          romaji: 'string?',
          meaning: ['string'],
          partOfSpeech: 'string?',
          explanation: 'string?',
          example: { text: 'string', reading: 'string?', translation: 'string' },
          recommendedToSave: 'boolean?',
        },
      ],
      grammar: [
        {
          pattern: 'string',
          meaning: 'string',
          explanation: 'string',
          example: { text: 'string', reading: 'string?', translation: 'string' },
        },
      ],
      tone: {
        register: 'formal|neutral|casual|rough',
        genderStyle: 'neutral|masculine|feminine',
        description: 'string?',
      },
      learningPoints: [{ title: 'string?', text: 'string' }],
    },
    null,
    2,
  )
}
