export const APP_NAME = 'Japanese Learning Assistant'
export const APP_VERSION = '0.1.0'

export const MAX_IMAGES_PER_MESSAGE = 4
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const

export const DEFAULT_RESPONSE_LANGUAGE = 'zh-CN'

export const DEFAULT_VOICE_GENDER = 'female' as const

export const SYSTEM_TTS_TEST_TEXT = 'こんにちは。これは発音テストです。'

export const DEFAULT_TTS_PROVIDER = 'system' as const
export const DEFAULT_MINIMAX_REGION = 'china' as const
export const DEFAULT_MINIMAX_MODEL = 'speech-2.8-hd' as const
export const DEFAULT_MINIMAX_FEMALE_VOICE = 'Japanese_CalmLady' as const
export const DEFAULT_MINIMAX_MALE_VOICE = 'Japanese_GentleButler' as const

export const MINIMAX_ENDPOINTS = {
  china: 'https://api.minimaxi.com/v1/t2a_v2',
  global: 'https://api.minimax.io/v1/t2a_v2',
} as const

export const MINIMAX_MODELS = ['speech-2.8-hd', 'speech-2.8-turbo'] as const

export const MINIMAX_FEMALE_VOICES = [
  'Japanese_CalmLady',
  'Japanese_KindLady',
  'Japanese_DependableWoman',
  'Japanese_GracefulMaiden',
  'Japanese_DecisivePrincess',
  'Japanese_ColdQueen',
] as const

export const MINIMAX_MALE_VOICES = [
  'Japanese_GentleButler',
  'Japanese_IntellectualSenior',
  'Japanese_LoyalKnight',
  'Japanese_DominantMan',
  'Japanese_SeriousCommander',
  'Japanese_OptimisticYouth',
  'Japanese_GenerousIzakayaOwner',
  'Japanese_SportyStudent',
  'Japanese_InnocentBoy',
] as const

export const MINIMAX_TIMEOUT_MS = 30_000

export const OBSIDIAN_DIRS = {
  root: 'Japanese',
  words: 'Words',
  sentences: 'Sentences',
  grammar: 'Grammar',
  assets: 'Assets',
} as const

export const IPC_CHANNELS = {
  conversationsList: 'conversations:list',
  conversationsCreate: 'conversations:create',
  conversationsGet: 'conversations:get',
  conversationsDelete: 'conversations:delete',
  messagesSend: 'messages:send',
  messagesRetry: 'messages:retry',
  notesList: 'notes:list',
  notesGet: 'notes:get',
  notesSave: 'notes:save',
  notesDelete: 'notes:delete',
  notesExport: 'notes:export',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  settingsSelectVault: 'settings:selectVault',
  ttsSpeak: 'tts:speak',
  attachmentsPick: 'attachments:pick',
  attachmentsRead: 'attachments:read',
} as const

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')
