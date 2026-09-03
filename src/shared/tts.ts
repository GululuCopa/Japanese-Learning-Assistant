import type { VoiceGender } from './types'

export function normalizeVoiceGender(value: unknown): VoiceGender {
  return value === 'male' ? 'male' : 'female'
}
