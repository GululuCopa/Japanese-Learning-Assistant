import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AIProvider, TTSProvider } from '../../src/shared/contracts'
import type { JapaneseAnalysis } from '../../src/shared/types'
import { createAppServices, type AppServices } from '../../src/main/app-services'
import type { KokoroRuntimeDeps } from '../../src/main/tts/kokoro-runtime'
import {
  createMemorySafeStorage,
  createUnavailableSafeStorage,
} from '../../src/main/settings/safe-storage'
import { kamauAnalysis } from '../fixtures/prd-cases'

export function tempDir(prefix = 'jla-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
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
  kokoro?: Partial<KokoroRuntimeDeps>
}): AppServices {
  const userDataDir = options?.userDataDir ?? tempDir()
  return createAppServices({
    userDataDir,
    safeStorage:
      options?.encryption === false ? createUnavailableSafeStorage() : createMemorySafeStorage(),
    aiProvider: options?.aiProvider ?? fixtureAI(options?.analysis),
    ttsProvider: options?.ttsProvider,
    fetchImpl: options?.fetchImpl,
    kokoro: {
      fileExists: () => false,
      ...options?.kokoro,
    },
  })
}
