import { DEFAULT_RESPONSE_LANGUAGE, MINIMAX_ENDPOINTS } from '@shared/constants'
import { ProviderError } from '@shared/errors'
import {
  normalizeMiniMaxFemaleVoice,
  normalizeMiniMaxMaleVoice,
  normalizeMiniMaxModel,
  normalizeMiniMaxRegion,
  normalizeTtsProvider,
  normalizeVoiceGender,
} from '@shared/tts'
import type {
  MiniMaxRegion,
  PublicSettings,
  SettingsUpdate,
  TTSProviderKind,
  VoiceGender,
} from '@shared/types'
import type { AppRepositories } from '../database/repositories'
import type { SafeStorageAdapter } from './safe-storage'

const SETTINGS_KEY = 'app'
const AI_SESSION_KEY = 'aiApiKey'
const MINIMAX_SESSION_KEY = 'minimaxApiKey'

interface EncryptedSecret {
  kind: 'encrypted'
  ciphertext: string
}

interface PersistedSettings {
  aiBaseUrl: string
  aiModel: string
  aiApiKey?: EncryptedSecret
  voiceGender: VoiceGender
  ttsProvider: TTSProviderKind
  minimaxRegion: MiniMaxRegion
  minimaxModel: string
  minimaxFemaleVoice: string
  minimaxMaleVoice: string
  minimaxApiKey?: EncryptedSecret
  obsidianVaultPath: string
  responseLanguage: 'zh-CN'
}

export interface ResolvedSecrets {
  aiApiKey?: string
  minimaxApiKey?: string
}

export interface MiniMaxTtsConfig {
  endpoint: string
  region: MiniMaxRegion
  model: string
  femaleVoice: string
  maleVoice: string
  apiKey: string
}

export class SettingsService {
  private readonly sessionSecrets = new Map<string, string>()

  constructor(
    private readonly repos: AppRepositories,
    private readonly safeStorage: SafeStorageAdapter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getPublic(): PublicSettings {
    const stored = this.read()
    const encryptionAvailable = this.safeStorage.isEncryptionAvailable()
    return {
      aiBaseUrl: stored.aiBaseUrl,
      aiModel: stored.aiModel,
      hasAiApiKey: Boolean(stored.aiApiKey) || this.sessionSecrets.has(AI_SESSION_KEY),
      voiceGender: stored.voiceGender,
      ttsProvider: stored.ttsProvider,
      minimaxRegion: stored.minimaxRegion,
      minimaxModel: stored.minimaxModel,
      minimaxFemaleVoice: stored.minimaxFemaleVoice,
      minimaxMaleVoice: stored.minimaxMaleVoice,
      hasMinimaxApiKey:
        Boolean(stored.minimaxApiKey) || this.sessionSecrets.has(MINIMAX_SESSION_KEY),
      obsidianVaultPath: stored.obsidianVaultPath,
      responseLanguage: stored.responseLanguage,
      encryptionAvailable,
      encryptionWarning: encryptionAvailable
        ? undefined
        : '当前系统无法使用操作系统加密。API Key 只会保存在本次会话内存中，关闭应用后需要重新填写。',
    }
  }

  save(update: SettingsUpdate): PublicSettings {
    const stored = this.read()
    const next: PersistedSettings = {
      aiBaseUrl: update.aiBaseUrl.trim(),
      aiModel: update.aiModel.trim(),
      aiApiKey: stored.aiApiKey,
      voiceGender: normalizeVoiceGender(update.voiceGender),
      ttsProvider: normalizeTtsProvider(update.ttsProvider),
      minimaxRegion: normalizeMiniMaxRegion(update.minimaxRegion),
      minimaxModel: normalizeMiniMaxModel(update.minimaxModel),
      minimaxFemaleVoice: normalizeMiniMaxFemaleVoice(update.minimaxFemaleVoice),
      minimaxMaleVoice: normalizeMiniMaxMaleVoice(update.minimaxMaleVoice),
      minimaxApiKey: stored.minimaxApiKey,
      obsidianVaultPath: update.obsidianVaultPath.trim(),
      responseLanguage: update.responseLanguage || DEFAULT_RESPONSE_LANGUAGE,
    }

    this.applySecret({
      incoming: update.aiApiKey,
      clear: update.clearAiApiKey,
      sessionKey: AI_SESSION_KEY,
      assign: (secret) => {
        next.aiApiKey = secret
      },
    })
    this.applySecret({
      incoming: update.minimaxApiKey,
      clear: update.clearMinimaxApiKey,
      sessionKey: MINIMAX_SESSION_KEY,
      assign: (secret) => {
        next.minimaxApiKey = secret
      },
    })

    this.repos.putSetting(SETTINGS_KEY, next, this.now().toISOString())
    return this.getPublic()
  }

  resolveSecrets(): ResolvedSecrets {
    const stored = this.read()
    return {
      aiApiKey: this.readSecret(stored.aiApiKey, AI_SESSION_KEY),
      minimaxApiKey: this.readSecret(stored.minimaxApiKey, MINIMAX_SESSION_KEY),
    }
  }

  requireAiConfig(): { baseUrl: string; model: string; apiKey: string } {
    const publicSettings = this.getPublic()
    const secrets = this.resolveSecrets()
    if (!publicSettings.aiBaseUrl || !publicSettings.aiModel || !secrets.aiApiKey) {
      throw new ProviderError(
        'configuration',
        '请先在设置中填写 AI 接口地址、模型和 API Key。',
        false,
      )
    }
    return {
      baseUrl: publicSettings.aiBaseUrl,
      model: publicSettings.aiModel,
      apiKey: secrets.aiApiKey,
    }
  }

  requireMinimaxTtsConfig(): MiniMaxTtsConfig {
    const publicSettings = this.getPublic()
    const secrets = this.resolveSecrets()
    if (!secrets.minimaxApiKey) {
      throw new ProviderError('configuration', '请先在设置中填写 MiniMax API Key。', false)
    }
    return {
      endpoint: MINIMAX_ENDPOINTS[publicSettings.minimaxRegion],
      region: publicSettings.minimaxRegion,
      model: publicSettings.minimaxModel,
      femaleVoice: publicSettings.minimaxFemaleVoice,
      maleVoice: publicSettings.minimaxMaleVoice,
      apiKey: secrets.minimaxApiKey,
    }
  }

  private applySecret(input: {
    incoming?: string
    clear?: boolean
    sessionKey: string
    assign: (secret: EncryptedSecret | undefined) => void
  }): void {
    if (input.clear) {
      this.sessionSecrets.delete(input.sessionKey)
      input.assign(undefined)
      return
    }
    if (input.incoming === undefined || input.incoming === '') {
      return
    }
    if (!this.safeStorage.isEncryptionAvailable()) {
      this.sessionSecrets.set(input.sessionKey, input.incoming)
      input.assign(undefined)
      return
    }
    const ciphertext = this.safeStorage.encryptString(input.incoming).toString('base64')
    this.sessionSecrets.delete(input.sessionKey)
    input.assign({ kind: 'encrypted', ciphertext })
  }

  private readSecret(stored: EncryptedSecret | undefined, sessionKey: string): string | undefined {
    const session = this.sessionSecrets.get(sessionKey)
    if (session) return session
    if (!stored) return undefined
    if (!this.safeStorage.isEncryptionAvailable()) return undefined
    try {
      return this.safeStorage.decryptString(Buffer.from(stored.ciphertext, 'base64'))
    } catch {
      return undefined
    }
  }

  private read(): PersistedSettings {
    const value = this.repos.getSetting(SETTINGS_KEY) as
      | (Partial<PersistedSettings> & {
          ttsBaseUrl?: string
          ttsModel?: string
          ttsVoice?: string
          ttsApiKey?: EncryptedSecret
        })
      | undefined
    return {
      aiBaseUrl: value?.aiBaseUrl ?? '',
      aiModel: value?.aiModel ?? '',
      aiApiKey: value?.aiApiKey,
      voiceGender: normalizeVoiceGender(value?.voiceGender),
      ttsProvider: normalizeTtsProvider(value?.ttsProvider),
      minimaxRegion: normalizeMiniMaxRegion(value?.minimaxRegion),
      minimaxModel: normalizeMiniMaxModel(value?.minimaxModel),
      minimaxFemaleVoice: normalizeMiniMaxFemaleVoice(value?.minimaxFemaleVoice),
      minimaxMaleVoice: normalizeMiniMaxMaleVoice(value?.minimaxMaleVoice),
      minimaxApiKey: value?.minimaxApiKey,
      obsidianVaultPath: value?.obsidianVaultPath ?? '',
      responseLanguage: value?.responseLanguage ?? DEFAULT_RESPONSE_LANGUAGE,
    }
  }
}
