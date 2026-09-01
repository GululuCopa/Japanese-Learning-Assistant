import type { SqliteDatabase } from './client'
import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  JapaneseAnalysis,
  MessageContent,
  NoteKind,
  NoteRecord,
  Source,
} from '@shared/types'
import { parseJapaneseAnalysis } from '@shared/schemas'

interface ConversationRow {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface MessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content_json: string
  error_json: string | null
  created_at: string
}

interface NoteRow {
  id: string
  kind: NoteKind
  duplicate_key: string
  title: string
  payload_json: string
  source_json: string | null
  original_sentence: string | null
  translation: string | null
  screenshot_attachment_id: string | null
  export_relpath: string | null
  created_at: string
  updated_at: string
}

export class AppRepositories {
  constructor(private readonly db: SqliteDatabase) {}

  createConversation(input: ConversationSummary): ConversationSummary {
    this.db
      .prepare(
        `INSERT INTO conversations (id, title, created_at, updated_at)
         VALUES (@id, @title, @createdAt, @updatedAt)`,
      )
      .run(input)
    return input
  }

  listConversations(): ConversationSummary[] {
    const rows = this.db
      .prepare('SELECT * FROM conversations ORDER BY updated_at DESC')
      .all() as ConversationRow[]
    return rows.map(mapConversation)
  }

  getConversation(id: string): ConversationSummary | undefined {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as
      ConversationRow | undefined
    return row ? mapConversation(row) : undefined
  }

  touchConversation(id: string, updatedAt: string, title?: string): void {
    if (title) {
      this.db
        .prepare('UPDATE conversations SET updated_at = ?, title = ? WHERE id = ?')
        .run(updatedAt, title, id)
      return
    }
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(updatedAt, id)
  }

  deleteConversation(id: string): void {
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
  }

  insertMessage(message: ChatMessage): void {
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content_json, error_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        message.id,
        message.conversationId,
        message.role,
        JSON.stringify(message.content),
        message.error ? JSON.stringify(message.error) : null,
        message.createdAt,
      )
  }

  updateMessageError(id: string, error: ChatMessage['error'] | null): void {
    this.db
      .prepare('UPDATE messages SET error_json = ? WHERE id = ?')
      .run(error ? JSON.stringify(error) : null, id)
  }

  getMessage(id: string): ChatMessage | undefined {
    const row = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as
      MessageRow | undefined
    if (!row) return undefined
    return this.hydrateMessage(row)
  }

  listMessages(conversationId: string): ChatMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(conversationId) as MessageRow[]
    return rows.map((row) => this.hydrateMessage(row))
  }

  insertAttachment(input: {
    id: string
    messageId: string
    storedName: string
    mimeType: string
    byteSize: number
    originalName?: string
    createdAt: string
  }): void {
    this.db
      .prepare(
        `INSERT INTO attachments (id, message_id, stored_name, mime_type, byte_size, original_name, created_at)
         VALUES (@id, @messageId, @storedName, @mimeType, @byteSize, @originalName, @createdAt)`,
      )
      .run({
        ...input,
        originalName: input.originalName ?? null,
      })
  }

  getAttachment(id: string):
    | {
        id: string
        messageId: string | null
        storedName: string
        mimeType: string
        byteSize: number
        originalName: string | null
      }
    | undefined {
    const row = this.db
      .prepare(
        `SELECT id, message_id as messageId, stored_name as storedName, mime_type as mimeType,
                byte_size as byteSize, original_name as originalName
         FROM attachments WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string
          messageId: string | null
          storedName: string
          mimeType: string
          byteSize: number
          originalName: string | null
        }
      | undefined
    return row
  }

  insertAnalysis(input: {
    id: string
    messageId: string
    analysis: JapaneseAnalysis
    createdAt: string
  }): void {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO analyses (id, message_id, analysis_json, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(input.id, input.messageId, JSON.stringify(input.analysis), input.createdAt)

      for (const item of input.analysis.vocabulary) {
        this.db
          .prepare(
            `INSERT INTO vocabulary_items (id, analysis_id, surface, lemma, reading, meaning_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            crypto.randomUUID(),
            input.id,
            item.surface,
            item.lemma ?? null,
            item.reading,
            JSON.stringify(item.meaning),
          )
      }
      for (const item of input.analysis.grammar) {
        this.db
          .prepare(
            `INSERT INTO grammar_items (id, analysis_id, pattern, meaning)
             VALUES (?, ?, ?, ?)`,
          )
          .run(crypto.randomUUID(), input.id, item.pattern, item.meaning)
      }
    })
    tx()
  }

  getConversationDetail(id: string): ConversationDetail | undefined {
    const conversation = this.getConversation(id)
    if (!conversation) return undefined
    return {
      ...conversation,
      messages: this.listMessages(id),
    }
  }

  getNoteByKey(kind: NoteKind, duplicateKey: string): NoteRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM notes WHERE kind = ? AND duplicate_key = ?')
      .get(kind, duplicateKey) as NoteRow | undefined
    return row ? mapNote(row) : undefined
  }

  getNoteById(id: string): NoteRecord | undefined {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined
    return row ? mapNote(row) : undefined
  }

  listNotes(kind: NoteKind, query?: string): NoteRecord[] {
    const rows =
      query && query.trim()
        ? (this.db
            .prepare(
              `SELECT * FROM notes
               WHERE kind = ?
                 AND (
                   title LIKE ? OR duplicate_key LIKE ? OR IFNULL(original_sentence, '') LIKE ?
                   OR IFNULL(translation, '') LIKE ? OR payload_json LIKE ?
                 )
               ORDER BY updated_at DESC`,
            )
            .all(
              kind,
              like(query),
              like(query),
              like(query),
              like(query),
              like(query),
            ) as NoteRow[])
        : (this.db
            .prepare('SELECT * FROM notes WHERE kind = ? ORDER BY updated_at DESC')
            .all(kind) as NoteRow[])
    return rows.map(mapNote)
  }

  insertNote(note: NoteRecord): void {
    this.db
      .prepare(
        `INSERT INTO notes (
           id, kind, duplicate_key, title, payload_json, source_json, original_sentence,
           translation, screenshot_attachment_id, export_relpath, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        note.id,
        note.kind,
        note.duplicateKey,
        note.title,
        JSON.stringify(note.payload),
        note.source ? JSON.stringify(note.source) : null,
        note.originalSentence ?? null,
        note.translation ?? null,
        note.screenshotAttachmentId ?? null,
        note.exportRelPath ?? null,
        note.createdAt,
        note.updatedAt,
      )
  }

  updateNoteExportPath(id: string, exportRelPath: string, updatedAt: string): void {
    this.db
      .prepare('UPDATE notes SET export_relpath = ?, updated_at = ? WHERE id = ?')
      .run(exportRelPath, updatedAt, id)
  }

  deleteNote(id: string): void {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id)
  }

  getSetting(key: string): unknown | undefined {
    const row = this.db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as
      { value_json: string } | undefined
    return row ? JSON.parse(row.value_json) : undefined
  }

  putSetting(key: string, value: unknown, updatedAt: string): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value), updatedAt)
  }

  deleteSetting(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  }

  savedWordKeys(): Set<string> {
    return new Set(
      (
        this.db.prepare("SELECT duplicate_key FROM notes WHERE kind = 'word'").all() as Array<{
          duplicate_key: string
        }>
      ).map((row) => row.duplicate_key),
    )
  }

  savedSentenceKeys(): Set<string> {
    return new Set(
      (
        this.db.prepare("SELECT duplicate_key FROM notes WHERE kind = 'sentence'").all() as Array<{
          duplicate_key: string
        }>
      ).map((row) => row.duplicate_key),
    )
  }

  savedGrammarKeys(): Set<string> {
    return new Set(
      (
        this.db.prepare("SELECT duplicate_key FROM notes WHERE kind = 'grammar'").all() as Array<{
          duplicate_key: string
        }>
      ).map((row) => row.duplicate_key),
    )
  }

  private hydrateMessage(row: MessageRow): ChatMessage {
    const analysisRow = this.db
      .prepare('SELECT analysis_json FROM analyses WHERE message_id = ?')
      .get(row.id) as { analysis_json: string } | undefined
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: JSON.parse(row.content_json) as MessageContent[],
      error: row.error_json ? JSON.parse(row.error_json) : undefined,
      createdAt: row.created_at,
      analysis: analysisRow
        ? parseJapaneseAnalysis(JSON.parse(analysisRow.analysis_json))
        : undefined,
    }
  }
}

function mapConversation(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapNote(row: NoteRow): NoteRecord {
  return {
    id: row.id,
    kind: row.kind,
    duplicateKey: row.duplicate_key,
    title: row.title,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    source: row.source_json ? (JSON.parse(row.source_json) as Source) : undefined,
    originalSentence: row.original_sentence ?? undefined,
    translation: row.translation ?? undefined,
    screenshotAttachmentId: row.screenshot_attachment_id ?? undefined,
    exportRelPath: row.export_relpath ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function like(query: string): string {
  return `%${query.trim()}%`
}
