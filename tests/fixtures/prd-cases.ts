import type { JapaneseAnalysis, StagedImage } from '../../src/shared/types'

export const kamauAnalysis: JapaneseAnalysis = {
  original: '俺に構うな',
  reading: 'おれに かまうな',
  translation: '别管我',
  literalTranslation: '不要理会我',
  explanation: '「構うな」属于禁止表达，语气偏冷淡、拒绝，不适合正式场景。',
  vocabulary: [
    {
      surface: '俺',
      lemma: '俺',
      reading: 'おれ',
      meaning: ['我'],
      partOfSpeech: '代词',
      explanation: '男性化、较粗犷的第一人称。',
    },
    {
      surface: '構う',
      lemma: '構う',
      reading: 'かまう',
      meaning: ['理会', '管', '在意'],
      partOfSpeech: '动词',
      explanation: '表示对某人或某事给予注意、干涉或理会。',
      recommendedToSave: true,
      example: {
        text: '俺に構うな',
        reading: 'おれに かまうな',
        translation: '别管我',
      },
    },
  ],
  grammar: [
    {
      pattern: '～な',
      meaning: '不要……',
      explanation: '动词终止形后接「な」表示禁止。',
      example: { text: '俺に構うな', translation: '别管我' },
    },
  ],
  tone: {
    register: 'rough',
    genderStyle: 'masculine',
    description: '偏冷淡、拒绝，不适合正式场景',
  },
  learningPoints: [{ text: '「構うな」属于禁止表达：不要管。' }],
}

export const namaikiAnalysis: JapaneseAnalysis = {
  original: '生意気',
  reading: 'なまいき',
  translation: '傲慢；自以为是',
  explanation: '用于批评对方态度傲慢或不知天高地厚。',
  vocabulary: [
    {
      surface: '生意気',
      lemma: '生意気',
      reading: 'なまいき',
      meaning: ['傲慢', '自以为是'],
      partOfSpeech: '形容动词',
      recommendedToSave: true,
    },
  ],
  grammar: [],
  tone: {
    register: 'casual',
    description: '口语中常见的批评性表达',
  },
  learningPoints: [{ text: '「生意気」读作なまいき。' }],
}

export const MINI_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export function miniPngImage(name = 'screenshot.png'): StagedImage {
  const dataBase64 = MINI_PNG_BASE64
  return {
    name,
    mimeType: 'image/png',
    byteSize: Buffer.from(dataBase64, 'base64').byteLength,
    dataBase64,
  }
}
