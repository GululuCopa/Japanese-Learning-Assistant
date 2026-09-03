import type { ProviderErrorCode } from './errors'

export type NoteKind = 'word' | 'sentence' | 'grammar'
export type MessageRole = 'user' | 'assistant'
export type ResponseLanguage = 'zh-CN'
export type VoiceGender = 'female' | 'male'
export type TTSProviderKind = 'system' | 'minimax'
export type MiniMaxRegion = 'china' | 'global'

export interface ExampleSentence {
  text: string
  reading?: string
  translation: string
}

export interface VocabularyItem {
  surface: string
  lemma?: string
  reading: string
  romaji?: string
  meaning: string[]
  partOfSpeech?: string
  explanation?: string
  example?: ExampleSentence
  recommendedToSave?: boolean
  alreadySaved?: boolean
}

export interface GrammarItem {
  pattern: string
  meaning: string
  explanation: string
  example?: ExampleSentence
  alreadySaved?: boolean
}

export interface ToneInfo {
  register?: 'formal' | 'neutral' | 'casual' | 'rough'
  genderStyle?: 'neutral' | 'masculine' | 'feminine'
  description?: string
}

export interface LearningPoint {
  title?: string
  text: string
}

export interface JapaneseAnalysis {
  original: string
  reading?: string
  translation: string
  literalTranslation?: string
  explanation?: string
  vocabulary: VocabularyItem[]
  grammar: GrammarItem[]
  tone?: ToneInfo
  learningPoints: LearningPoint[]
  sentenceAlreadySaved?: boolean
}

export interface Source {
  type: 'game' | 'anime' | 'manga' | 'web' | 'chat' | 'manual'
  title?: string
  url?: string
  screenshotId?: string
}

export interface ImageAttachmentMeta {
  id: string
  mimeType: string
  byteSize: number
  originalName?: string
}

export type MessageContent =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      attachmentId: string
      mimeType: string
      originalName?: string
      dataBase64?: string
    }

export interface ErrorPayload {
  code: ProviderErrorCode
  message: string
  retryable: boolean
}

export interface ConversationSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: MessageRole
  content: MessageContent[]
  analysis?: JapaneseAnalysis
  error?: ErrorPayload
  createdAt: string
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[]
}

export interface StagedImage {
  name: string
  mimeType: string
  byteSize: number
  dataBase64: string
}

export interface SendMessageInput {
  conversationId: string
  text: string
  images: StagedImage[]
}

export interface SendMessageResult {
  conversation: ConversationSummary
  userMessage: ChatMessage
  assistantMessage?: ChatMessage
}

export interface NoteRecord {
  id: string
  kind: NoteKind
  duplicateKey: string
  title: string
  payload: Record<string, unknown>
  source?: Source
  originalSentence?: string
  translation?: string
  screenshotAttachmentId?: string
  exportRelPath?: string
  createdAt: string
  updatedAt: string
}

export interface ListNotesInput {
  kind: NoteKind
  query?: string
}

export type SaveNoteInput =
  | {
      kind: 'word'
      conversationId?: string
      messageId?: string
      item: VocabularyItem
      originalSentence?: string
      translation?: string
      screenshotAttachmentId?: string
      source?: Source
    }
  | {
      kind: 'sentence'
      conversationId?: string
      messageId?: string
      original: string
      reading?: string
      translation: string
      screenshotAttachmentId?: string
      source?: Source
    }
  | {
      kind: 'grammar'
      conversationId?: string
      messageId?: string
      item: GrammarItem
      originalSentence?: string
      translation?: string
      screenshotAttachmentId?: string
      source?: Source
    }

export interface SaveNoteResult {
  note: NoteRecord
  alreadySaved: boolean
}

export interface ExportResult {
  ok: boolean
  relPath?: string
  absolutePath?: string
  message: string
}

export interface DeleteNoteResult {
  ok: true
  obsidianFileDeleted: boolean
  message: string
}

export interface SettingsUpdate {
  aiBaseUrl: string
  aiModel: string
  aiApiKey?: string
  voiceGender: VoiceGender
  ttsProvider: TTSProviderKind
  minimaxRegion: MiniMaxRegion
  minimaxModel: string
  minimaxFemaleVoice: string
  minimaxMaleVoice: string
  minimaxApiKey?: string
  obsidianVaultPath: string
  responseLanguage: ResponseLanguage
  clearAiApiKey?: boolean
  clearMinimaxApiKey?: boolean
}

export interface PublicSettings {
  aiBaseUrl: string
  aiModel: string
  hasAiApiKey: boolean
  voiceGender: VoiceGender
  ttsProvider: TTSProviderKind
  minimaxRegion: MiniMaxRegion
  minimaxModel: string
  minimaxFemaleVoice: string
  minimaxMaleVoice: string
  hasMinimaxApiKey: boolean
  obsidianVaultPath: string
  responseLanguage: ResponseLanguage
  encryptionAvailable: boolean
  encryptionWarning?: string
}

export interface SpeakInput {
  text: string
  speed: 0.75 | 1
  voiceGender?: VoiceGender
}

export interface SpeakResult {
  mimeType: string
  dataBase64: string
  cached: boolean
}

export interface AttachmentBytes {
  mimeType: string
  dataBase64: string
}

export interface AnalyzeRequest {
  text?: string
  images?: Array<{ mimeType: string; dataBase64: string }>
  conversationContext?: Array<{ role: MessageRole; text: string }>
  responseLanguage: ResponseLanguage
}

export interface TTSOptions {
  model?: string
  voice?: string
  speed?: 0.75 | 1
  voiceGender?: VoiceGender
}

export interface AudioResult {
  mimeType: string
  bytes: Uint8Array
  cached: boolean
}

export interface JapaneseAssistantAPI {
  conversations: {
    list(): Promise<ConversationSummary[]>
    create(): Promise<ConversationSummary>
    get(id: string): Promise<ConversationDetail>
    delete(id: string): Promise<void>
  }
  messages: {
    send(input: SendMessageInput): Promise<SendMessageResult>
    retry(messageId: string): Promise<SendMessageResult>
  }
  notes: {
    list(input: ListNotesInput): Promise<NoteRecord[]>
    get(id: string): Promise<NoteRecord>
    save(input: SaveNoteInput): Promise<SaveNoteResult>
    delete(id: string): Promise<DeleteNoteResult>
    exportToObsidian(id: string): Promise<ExportResult>
  }
  settings: {
    get(): Promise<PublicSettings>
    save(input: SettingsUpdate): Promise<PublicSettings>
    selectVault(): Promise<string | null>
  }
  tts: {
    speak(input: SpeakInput): Promise<SpeakResult>
  }
  attachments: {
    pickImages(): Promise<StagedImage[]>
    read(id: string): Promise<AttachmentBytes>
  }
}
