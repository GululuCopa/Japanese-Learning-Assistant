import { grammarDuplicateKey, sentenceDuplicateKey, wordDuplicateKey } from '@shared/notes'
import type { NoteRecord, SaveNoteInput, SaveNoteResult } from '@shared/types'
import type { AppRepositories } from '../database/repositories'
import { annotateAnalysis } from './annotate'

export class NotesService {
  constructor(
    private readonly repos: AppRepositories,
    private readonly now: () => Date,
    private readonly randomId: () => string,
  ) {}

  save(input: SaveNoteInput): SaveNoteResult {
    const timestamp = this.now().toISOString()
    if (input.kind === 'word') {
      const duplicateKey = wordDuplicateKey(input.item)
      const existing = this.repos.getNoteByKey('word', duplicateKey)
      if (existing) {
        return { note: existing, alreadySaved: true }
      }
      const note = this.createNote({
        kind: 'word',
        duplicateKey,
        title: input.item.surface,
        payload: { ...input.item },
        originalSentence: input.originalSentence,
        translation: input.translation,
        screenshotAttachmentId: input.screenshotAttachmentId,
        source: input.source,
        timestamp,
      })
      return { note, alreadySaved: false }
    }

    if (input.kind === 'sentence') {
      const duplicateKey = sentenceDuplicateKey(input.original)
      const existing = this.repos.getNoteByKey('sentence', duplicateKey)
      if (existing) {
        return { note: existing, alreadySaved: true }
      }
      const note = this.createNote({
        kind: 'sentence',
        duplicateKey,
        title: input.original,
        payload: {
          text: input.original,
          reading: input.reading,
          translation: input.translation,
        },
        originalSentence: input.original,
        translation: input.translation,
        screenshotAttachmentId: input.screenshotAttachmentId,
        source: input.source,
        timestamp,
      })
      return { note, alreadySaved: false }
    }

    const duplicateKey = grammarDuplicateKey(input.item)
    const existing = this.repos.getNoteByKey('grammar', duplicateKey)
    if (existing) {
      return { note: existing, alreadySaved: true }
    }
    const note = this.createNote({
      kind: 'grammar',
      duplicateKey,
      title: input.item.pattern,
      payload: { ...input.item },
      originalSentence: input.originalSentence,
      translation: input.translation,
      screenshotAttachmentId: input.screenshotAttachmentId,
      source: input.source,
      timestamp,
    })
    return { note, alreadySaved: false }
  }

  list(kind: NoteRecord['kind'], query?: string): NoteRecord[] {
    return this.repos.listNotes(kind, query)
  }

  get(id: string): NoteRecord {
    const note = this.repos.getNoteById(id)
    if (!note) {
      throw new Error('笔记不存在')
    }
    return note
  }

  delete(id: string): void {
    this.repos.deleteNote(id)
  }

  annotate = annotateAnalysis

  private createNote(input: {
    kind: NoteRecord['kind']
    duplicateKey: string
    title: string
    payload: Record<string, unknown>
    originalSentence?: string
    translation?: string
    screenshotAttachmentId?: string
    source?: NoteRecord['source']
    timestamp: string
  }): NoteRecord {
    const note: NoteRecord = {
      id: this.randomId(),
      kind: input.kind,
      duplicateKey: input.duplicateKey,
      title: input.title,
      payload: input.payload,
      originalSentence: input.originalSentence,
      translation: input.translation,
      screenshotAttachmentId: input.screenshotAttachmentId,
      source: input.source,
      createdAt: input.timestamp,
      updatedAt: input.timestamp,
    }
    this.repos.insertNote(note)
    return note
  }
}
