import { DEFAULT_RESPONSE_LANGUAGE } from '@shared/constants'
import { ProviderError, toErrorPayload, userFacingProviderMessage } from '@shared/errors'
import type {
  ChatMessage,
  ConversationSummary,
  JapaneseAnalysis,
  MessageContent,
  SendMessageInput,
  SendMessageResult,
} from '@shared/types'
import { validateStagedImages } from '@shared/image'
import type { AIProvider } from '@shared/contracts'
import type { AppRepositories } from '../database/repositories'
import { AttachmentStore } from '../attachments/store'
import { NotesService } from '../notes/service'
import type { SettingsService } from '../settings/service'

export class ConversationService {
  constructor(
    private readonly repos: AppRepositories,
    private readonly attachments: AttachmentStore,
    private readonly notes: NotesService,
    private readonly settings: SettingsService,
    private readonly createAI: () => AIProvider,
    private readonly now: () => Date,
    private readonly randomId: () => string,
  ) {}

  list(): ConversationSummary[] {
    return this.repos.listConversations()
  }

  create(): ConversationSummary {
    const timestamp = this.now().toISOString()
    return this.repos.createConversation({
      id: this.randomId(),
      title: '新对话',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  get(id: string) {
    const detail = this.repos.getConversationDetail(id)
    if (!detail) {
      throw new Error('对话不存在')
    }
    return {
      ...detail,
      messages: detail.messages.map((message) =>
        message.analysis
          ? { ...message, analysis: this.notes.annotate(message.analysis, this.repos) }
          : message,
      ),
    }
  }

  delete(id: string): void {
    this.repos.deleteConversation(id)
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const conversation = this.repos.getConversation(input.conversationId)
    if (!conversation) {
      throw new Error('对话不存在')
    }
    const text = input.text.trim()
    const images = validateStagedImages(input.images ?? [])
    if (!text && images.length === 0) {
      throw new Error('请输入文本或添加图片')
    }

    const timestamp = this.now().toISOString()
    const stored = images.length ? this.attachments.store(images) : []
    const content: MessageContent[] = []
    if (text) {
      content.push({ type: 'text', text })
    }
    const userMessage: ChatMessage = {
      id: this.randomId(),
      conversationId: conversation.id,
      role: 'user',
      content: [
        ...content,
        ...stored.map((item) => ({
          type: 'image' as const,
          attachmentId: item.id,
          mimeType: item.mimeType,
          originalName: item.originalName,
        })),
      ],
      createdAt: timestamp,
    }

    this.repos.insertMessage(userMessage)
    for (const item of stored) {
      this.repos.insertAttachment({
        id: item.id,
        messageId: userMessage.id,
        storedName: item.storedName,
        mimeType: item.mimeType,
        byteSize: item.byteSize,
        originalName: item.originalName,
        createdAt: timestamp,
      })
    }
    const title = conversation.title === '新对话' ? deriveTitle(text, images.length > 0) : undefined
    this.repos.touchConversation(conversation.id, timestamp, title)

    return this.analyzeUserMessage(userMessage)
  }

  async retry(messageId: string): Promise<SendMessageResult> {
    const message = this.repos.getMessage(messageId)
    if (!message || message.role !== 'user') {
      throw new Error('无法重试该消息')
    }
    return this.analyzeUserMessage(message)
  }

  private async analyzeUserMessage(userMessage: ChatMessage): Promise<SendMessageResult> {
    const conversation = this.repos.getConversation(userMessage.conversationId)!
    try {
      const analysis = await this.runAnalysis(userMessage)
      const annotated = this.notes.annotate(analysis, this.repos)
      const assistantMessage: ChatMessage = {
        id: this.randomId(),
        conversationId: userMessage.conversationId,
        role: 'assistant',
        content: [{ type: 'text', text: annotated.original }],
        analysis: annotated,
        createdAt: this.now().toISOString(),
      }
      this.repos.insertMessage(assistantMessage)
      this.repos.insertAnalysis({
        id: this.randomId(),
        messageId: assistantMessage.id,
        analysis,
        createdAt: assistantMessage.createdAt,
      })
      this.repos.updateMessageError(userMessage.id, null)
      this.repos.touchConversation(conversation.id, assistantMessage.createdAt)
      return {
        conversation: this.repos.getConversation(conversation.id)!,
        userMessage: { ...userMessage, error: undefined },
        assistantMessage,
      }
    } catch (error) {
      const payload = toErrorPayload(error)
      payload.message =
        error instanceof ProviderError
          ? userFacingProviderMessage(error.code, error.message)
          : payload.message
      this.repos.updateMessageError(userMessage.id, payload)
      const failedUser = { ...userMessage, error: payload }
      return {
        conversation: this.repos.getConversation(conversation.id)!,
        userMessage: failedUser,
      }
    }
  }

  private async runAnalysis(userMessage: ChatMessage): Promise<JapaneseAnalysis> {
    const images = userMessage.content
      .filter((part) => part.type === 'image')
      .map((part) => {
        const attachment = this.repos.getAttachment(part.attachmentId)
        if (!attachment) {
          throw new Error('找不到图片附件')
        }
        const bytes = this.attachments.read(attachment.storedName)
        return {
          mimeType: attachment.mimeType,
          dataBase64: bytes.toString('base64'),
        }
      })
    const text = userMessage.content
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
    const context = this.repos
      .listMessages(userMessage.conversationId)
      .filter((message) => message.id !== userMessage.id)
      .slice(-6)
      .map((message) => ({
        role: message.role,
        text:
          message.role === 'assistant' && message.analysis
            ? message.analysis.original
            : message.content
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('\n'),
      }))

    const provider = this.createAI()
    return provider.analyze({
      text,
      images,
      conversationContext: context,
      responseLanguage: this.settings.getPublic().responseLanguage || DEFAULT_RESPONSE_LANGUAGE,
    })
  }
}

function deriveTitle(text: string, hasImage: boolean): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact) {
    return compact.slice(0, 24)
  }
  return hasImage ? '截图分析' : '新对话'
}
