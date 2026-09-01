import { KOKORO_VOICES } from './constants'
import type { VoiceGender } from './types'

export function normalizeVoiceGender(value: unknown): VoiceGender {
  return value === 'male' ? 'male' : 'female'
}

export function kokoroVoiceForGender(gender: VoiceGender): string {
  return KOKORO_VOICES[normalizeVoiceGender(gender)]
}
