import fs from 'node:fs'
import type { AIProvider, TTSProvider } from '@shared/contracts'
import type {
  AttachmentBytes,
  ExportResult,
  ListNotesInput,
  PublicSettings,
  SaveNoteInput,
  SendMessageInput,
  SettingsUpdate,
  SpeakInput,
  SpeakResult,
  StagedImage,
} from '@shared/types'
import { OpenAICompatibleAIProvider } from './ai/openai-compatible'
import { AttachmentStore } from './attachments/store'
import { ConversationService } from './conversation/service'
import { openDatabase, type SqliteDatabase } from './database/client'
import { AppRepositories } from './database/repositories'
import { NotesService } from './notes/service'
import { ObsidianExporter } from './obsidian/export'
import { createAppPaths, type AppPaths } from './paths'
import { SettingsService } from './settings/service'
import type { SafeStorageAdapter } from './settings/safe-storage'
import { SystemTTSProvider } from './tts/system'

export interface AppServiceOptions {
  userDataDir: string
  safeStorage: SafeStorageAdapter
  fetchImpl?: typeof fetch
  now?: () => Date
  randomId?: () => string
  aiProvider?: AIProvider
  ttsProvider?: TTSProvider
  selectDirectory?: () => Promise<string | null>
}

export class AppServices {
  readonly paths: AppPaths
  readonly db: SqliteDatabase
  readonly repos: AppRepositories
  readonly settings: SettingsService
  readonly notes: NotesService
  readonly conversations: ConversationService
  readonly attachments: AttachmentStore
  readonly exporter: ObsidianExporter
  private readonly fetchImpl?: typeof fetch
  private readonly ttsOverride?: TTSProvider
  readonly selectDirectory?: () => Promise<string | null>

  constructor(options: AppServiceOptions) {
    this.paths = createAppPaths(options.userDataDir)
    fs.mkdirSync(this.paths.userDataDir, { recursive: true })
    fs.mkdirSync(this.paths.attachmentsDir, { recursive: true })
    fs.mkdirSync(this.paths.audioCacheDir, { recursive: true })
    this.db = openDatabase(this.paths.databaseFile)
    this.repos = new AppRepositories(this.db)
    const now = options.now ?? (() => new Date())
    const randomId = options.randomId ?? (() => crypto.randomUUID())
    this.settings = new SettingsService(this.repos, options.safeStorage, now)
    this.notes = new NotesService(this.repos, now, randomId)
    this.attachments = new AttachmentStore(this.paths.attachmentsDir, randomId)
    this.exporter = new ObsidianExporter(
      this.repos,
      (storedName) => this.attachments.read(storedName),
      now,
    )
    this.fetchImpl = options.fetchImpl
    this.ttsOverride = options.ttsProvider
    this.selectDirectory = options.selectDirectory
    this.conversations = new ConversationService(
      this.repos,
      this.attachments,
      this.notes,
      this.settings,
      () => options.aiProvider ?? this.createAIProvider(),
      now,
      randomId,
    )
  }

  createAIProvider(): AIProvider {
    const config = this.settings.requireAiConfig()
    return new OpenAICompatibleAIProvider({
      ...config,
      fetchImpl: this.fetchImpl,
    })
  }

  async createTTSProvider(): Promise<TTSProvider> {
    if (this.ttsOverride) return this.ttsOverride
    return new SystemTTSProvider({
      cacheDir: this.paths.audioCacheDir,
    })
  }

  saveSettings(update: SettingsUpdate): PublicSettings {
    return this.settings.save(update)
  }

  async speak(input: SpeakInput): Promise<SpeakResult> {
    const provider = await this.createTTSProvider()
    const result = await provider.speak(input.text, {
      speed: input.speed,
      voiceGender: this.settings.getPublic().voiceGender,
    })
    return {
      mimeType: result.mimeType,
      dataBase64: Buffer.from(result.bytes).toString('base64'),
      cached: result.cached,
    }
  }

  saveNote(input: SaveNoteInput) {
    return this.notes.save(input)
  }

  listNotes(input: ListNotesInput) {
    return this.notes.list(input.kind, input.query)
  }

  exportNote(id: string): ExportResult {
    const vault = this.settings.getPublic().obsidianVaultPath
    return this.exporter.exportNote(id, vault)
  }

  async sendMessage(input: SendMessageInput) {
    return this.conversations.send(input)
  }

  readAttachment(id: string): AttachmentBytes {
    const attachment = this.repos.getAttachment(id)
    if (!attachment) {
      throw new Error('附件不存在')
    }
    const bytes = this.attachments.read(attachment.storedName)
    return {
      mimeType: attachment.mimeType,
      dataBase64: bytes.toString('base64'),
    }
  }

  close(): void {
    this.db.close()
  }
}

export function createAppServices(options: AppServiceOptions): AppServices {
  return new AppServices(options)
}

export type { StagedImage }
