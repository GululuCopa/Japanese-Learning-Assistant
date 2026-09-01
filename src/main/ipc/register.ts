import { readFile, stat } from 'node:fs/promises'
import { dialog, type IpcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { stagePickedImageFiles } from '../attachments/pick'
import {
  attachmentReadSchema,
  idSchema,
  listNotesSchema,
  retryMessageSchema,
  saveNoteSchema,
  sendMessageSchema,
  settingsUpdateSchema,
  speakInputSchema,
} from '@shared/schemas'
import type { AppServices } from '../app-services'

export function registerIpc(ipcMain: IpcMain, services: AppServices): void {
  ipcMain.handle(IPC_CHANNELS.conversationsList, () => services.conversations.list())
  ipcMain.handle(IPC_CHANNELS.conversationsCreate, () => services.conversations.create())
  ipcMain.handle(IPC_CHANNELS.conversationsGet, (_event, raw) => {
    const { id } = idSchema.parse(raw)
    return services.conversations.get(id)
  })
  ipcMain.handle(IPC_CHANNELS.conversationsDelete, (_event, raw) => {
    const { id } = idSchema.parse(raw)
    services.conversations.delete(id)
  })
  ipcMain.handle(IPC_CHANNELS.messagesSend, (_event, raw) => {
    const input = sendMessageSchema.parse(raw)
    return services.sendMessage(input)
  })
  ipcMain.handle(IPC_CHANNELS.messagesRetry, (_event, raw) => {
    const { messageId } = retryMessageSchema.parse(raw)
    return services.conversations.retry(messageId)
  })
  ipcMain.handle(IPC_CHANNELS.notesList, (_event, raw) => {
    const input = listNotesSchema.parse(raw)
    return services.listNotes(input)
  })
  ipcMain.handle(IPC_CHANNELS.notesGet, (_event, raw) => {
    const { id } = idSchema.parse(raw)
    return services.notes.get(id)
  })
  ipcMain.handle(IPC_CHANNELS.notesSave, (_event, raw) => {
    const input = saveNoteSchema.parse(raw)
    return services.saveNote(input)
  })
  ipcMain.handle(IPC_CHANNELS.notesDelete, (_event, raw) => {
    const { id } = idSchema.parse(raw)
    services.notes.delete(id)
  })
  ipcMain.handle(IPC_CHANNELS.notesExport, (_event, raw) => {
    const { id } = idSchema.parse(raw)
    return services.exportNote(id)
  })
  ipcMain.handle(IPC_CHANNELS.settingsGet, () => services.settings.getPublic())
  ipcMain.handle(IPC_CHANNELS.settingsSave, (_event, raw) => {
    const input = settingsUpdateSchema.parse(raw)
    return services.saveSettings(input)
  })
  ipcMain.handle(IPC_CHANNELS.settingsSelectVault, async () => {
    if (services.selectDirectory) {
      return services.selectDirectory()
    }
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  ipcMain.handle(IPC_CHANNELS.ttsSpeak, (_event, raw) => {
    const input = speakInputSchema.parse(raw)
    return services.speak(input)
  })
  ipcMain.handle(IPC_CHANNELS.attachmentsPick, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    })
    if (result.canceled) return []
    return stagePickedImageFiles(result.filePaths, {
      statSize: async (filePath) => (await stat(filePath)).size,
      readFile,
    })
  })
  ipcMain.handle(IPC_CHANNELS.attachmentsRead, (_event, raw) => {
    const { id } = attachmentReadSchema.parse(raw)
    return services.readAttachment(id)
  })
}
