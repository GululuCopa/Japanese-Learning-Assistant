import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AIProvider, TTSProvider } from '../../src/shared/contracts'
import {
  DEFAULT_MINIMAX_FEMALE_VOICE,
  DEFAULT_MINIMAX_MALE_VOICE,
  DEFAULT_MINIMAX_MODEL,
} from '../../src/shared/constants'
import type { JapaneseAnalysis, SettingsUpdate } from '../../src/shared/types'
import { createAppServices, type AppServices } from '../../src/main/app-services'
import {
  createMemorySafeStorage,
  createUnavailableSafeStorage,
} from '../../src/main/settings/safe-storage'
import { kamauAnalysis } from '../fixtures/prd-cases'

export function tempDir(prefix = 'jla-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

export const defaultTtsSettings = {
  ttsProvider: 'system' as const,
  minimaxRegion: 'china' as const,
  minimaxModel: DEFAULT_MINIMAX_MODEL,
  minimaxFemaleVoice: DEFAULT_MINIMAX_FEMALE_VOICE,
  minimaxMaleVoice: DEFAULT_MINIMAX_MALE_VOICE,
}

export function testSettings(overrides: Partial<SettingsUpdate> = {}): SettingsUpdate {
  return {
    aiBaseUrl: 'https://example.test/v1',
    aiModel: 'gpt-test',
    voiceGender: 'female',
    obsidianVaultPath: '',
    responseLanguage: 'zh-CN',
    ...defaultTtsSettings,
    ...overrides,
  }
}

export function fixtureAI(analysis: JapaneseAnalysis = kamauAnalysis): AIProvider {
  return {
    analyze: async () => structuredClone(analysis),
  }
}

export function createTestApp(options?: {
  analysis?: JapaneseAnalysis
  aiProvider?: AIProvider
  ttsProvider?: TTSProvider
  encryption?: boolean
  fetchImpl?: typeof fetch
  userDataDir?: string
}): AppServices {
  const userDataDir = options?.userDataDir ?? tempDir()
  return createAppServices({
    userDataDir,
    safeStorage:
      options?.encryption === false ? createUnavailableSafeStorage() : createMemorySafeStorage(),
    aiProvider: options?.aiProvider ?? fixtureAI(options?.analysis),
    ttsProvider: options?.ttsProvider,
    fetchImpl: options?.fetchImpl,
  })
}
