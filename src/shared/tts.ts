import {
  DEFAULT_MINIMAX_FEMALE_VOICE,
  DEFAULT_MINIMAX_MALE_VOICE,
  DEFAULT_MINIMAX_MODEL,
  DEFAULT_MINIMAX_REGION,
  DEFAULT_TTS_PROVIDER,
  MINIMAX_FEMALE_VOICES,
  MINIMAX_MALE_VOICES,
  MINIMAX_MODELS,
} from './constants'
import type { MiniMaxRegion, TTSProviderKind, VoiceGender } from './types'

export function normalizeVoiceGender(value: unknown): VoiceGender {
  return value === 'male' ? 'male' : 'female'
}

export function normalizeTtsProvider(value: unknown): TTSProviderKind {
  return value === 'minimax' ? 'minimax' : DEFAULT_TTS_PROVIDER
}

export function normalizeMiniMaxRegion(value: unknown): MiniMaxRegion {
  return value === 'global' ? 'global' : DEFAULT_MINIMAX_REGION
}

export function normalizeMiniMaxModel(value: unknown): string {
  return (MINIMAX_MODELS as readonly string[]).includes(String(value))
    ? String(value)
    : DEFAULT_MINIMAX_MODEL
}

export function normalizeMiniMaxFemaleVoice(value: unknown): string {
  return (MINIMAX_FEMALE_VOICES as readonly string[]).includes(String(value))
    ? String(value)
    : DEFAULT_MINIMAX_FEMALE_VOICE
}

export function normalizeMiniMaxMaleVoice(value: unknown): string {
  return (MINIMAX_MALE_VOICES as readonly string[]).includes(String(value))
    ? String(value)
    : DEFAULT_MINIMAX_MALE_VOICE
}
