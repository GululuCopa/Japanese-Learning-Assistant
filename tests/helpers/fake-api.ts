import { vi } from 'vitest'
import type {
  JapaneseAssistantAPI,
  NoteRecord,
  PublicSettings,
  ChatMessage,
  ConversationDetail,
  StagedImage,
} from '../../src/shared/types'
import { kamauAnalysis } from '../fixtures/prd-cases'

export function createFakeApi(options?: {
  configured?: boolean
  holdSend?: boolean
  failSend?: boolean
  failGet?: boolean
  distinctCreate?: boolean
  historyConversations?: ConversationDetail[]
}): {
  api: JapaneseAssistantAPI
  notes: NoteRecord[]
  releaseSend: () => void
} {
  let releaseSend: () => void = () => undefined
  const sendGate = options?.holdSend
    ? new Promise<void>((resolve) => {
        releaseSend = () => resolve()
      })
    : Promise.resolve()
  const notes: NoteRecord[] = []
  const settings: PublicSettings = {
    aiBaseUrl: options?.configured === false ? '' : 'https://example.test/v1',
    aiModel: options?.configured === false ? '' : 'gpt-test',
    hasAiApiKey: options?.configured !== false,
    voiceGender: 'female',
    obsidianVaultPath: '',
    responseLanguage: 'zh-CN',
    encryptionAvailable: true,
  }
  const conversation: ConversationDetail = {
    id: 'c1',
    title: '新对话',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    messages: [],
  }

  const api: JapaneseAssistantAPI = {
    conversations: {
      list: vi.fn(async () => [
        {
          id: conversation.id,
          title: conversation.title,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
        ...(options?.historyConversations ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
      ]),
      create: vi.fn(async () => {
        if (options?.distinctCreate) {
          return {
            id: 'c-new',
            title: '新对话',
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
          }
        }
        return conversation
      }),
      get: vi.fn(async (id: string) => {
        if (options?.failGet) {
          throw new Error('对话不存在')
        }
        const extra = options?.historyConversations?.find((item) => item.id === id)
        if (extra) return structuredClone(extra)
        if (id === conversation.id) return structuredClone(conversation)
        return {
          id,
          title: '新对话',
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          messages: [],
        }
      }),
      delete: vi.fn(async () => undefined),
    },
    messages: {
      send: vi.fn(async (input) => {
        await sendGate
        if (options?.failSend) {
          throw new Error('分析失败')
        }
        const user: ChatMessage = {
          id: 'u1',
          conversationId: input.conversationId,
          role: 'user',
          content: [
            ...(input.text.trim() ? [{ type: 'text' as const, text: input.text }] : []),
            ...input.images.map((image: StagedImage, index: number) => ({
              type: 'image' as const,
              attachmentId: `att-${index}`,
              mimeType: image.mimeType,
              originalName: image.name,
            })),
          ],
          createdAt: '2026-09-01T00:00:01.000Z',
        }
        const analysis = structuredClone(kamauAnalysis)
        analysis.vocabulary = analysis.vocabulary.map((item) => ({
          ...item,
          alreadySaved: notes.some(
            (note) => note.title === item.surface || note.duplicateKey === item.lemma,
          ),
        }))
        const assistant: ChatMessage = {
          id: 'a1',
          conversationId: input.conversationId,
          role: 'assistant',
          content: [{ type: 'text', text: analysis.original }],
          analysis,
          createdAt: '2026-09-01T00:00:02.000Z',
        }
        if (input.conversationId === conversation.id) {
          conversation.messages = [user, assistant]
          conversation.title = input.text.slice(0, 24)
          return { conversation, userMessage: user, assistantMessage: assistant }
        }
        return {
          conversation: {
            id: input.conversationId,
            title: input.text.slice(0, 24) || '新对话',
            createdAt: conversation.createdAt,
            updatedAt: '2026-09-01T00:00:02.000Z',
          },
          userMessage: user,
          assistantMessage: assistant,
        }
      }),
      retry: vi.fn(async () => {
        throw new Error('not used')
      }),
    },
    notes: {
      list: vi.fn(async ({ query }) =>
        notes.filter(
          (note) =>
            !query || note.title.includes(query) || JSON.stringify(note.payload).includes(query),
        ),
      ),
      get: vi.fn(async (id) => notes.find((note) => note.id === id)!),
      save: vi.fn(async (input) => {
        if (input.kind !== 'word') {
          throw new Error('test helper only implements word save')
        }
        const existing = notes.find(
          (note) => note.duplicateKey === (input.item.lemma || input.item.surface),
        )
        if (existing) return { note: existing, alreadySaved: true }
        const note: NoteRecord = {
          id: 'n1',
          kind: 'word',
          duplicateKey: input.item.lemma || input.item.surface,
          title: input.item.surface,
          payload: { ...input.item },
          createdAt: '2026-09-01T00:00:03.000Z',
          updatedAt: '2026-09-01T00:00:03.000Z',
        }
        notes.push(note)
        return { note, alreadySaved: false }
      }),
      delete: vi.fn(async () => undefined),
      exportToObsidian: vi.fn(async () => ({
        ok: true,
        relPath: 'Japanese/Words/構う.md',
        message: '已导出到 Japanese/Words/構う.md',
      })),
    },
    settings: {
      get: vi.fn(async () => settings),
      save: vi.fn(async (update) => {
        Object.assign(settings, {
          aiBaseUrl: update.aiBaseUrl,
          aiModel: update.aiModel,
          hasAiApiKey: Boolean(update.aiApiKey) || settings.hasAiApiKey,
          voiceGender: update.voiceGender,
          obsidianVaultPath: update.obsidianVaultPath,
        })
        return settings
      }),
      selectVault: vi.fn(async () => 'D:\\Obsidian\\MyVault'),
    },
    tts: {
      speak: vi.fn(async () => ({
        mimeType: 'audio/mpeg',
        dataBase64: Buffer.from('audio').toString('base64'),
        cached: false,
      })),
    },
    attachments: {
      pickImages: vi.fn(async () => []),
      read: vi.fn(async () => ({
        mimeType: 'image/png',
        dataBase64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      })),
    },
  }

  return { api, notes, releaseSend }
}
