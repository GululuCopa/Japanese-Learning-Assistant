import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  JapaneseAssistantAPI,
  ListNotesInput,
  SaveNoteInput,
  SendMessageInput,
  SettingsUpdate,
  SpeakInput,
} from '@shared/types'

const api: JapaneseAssistantAPI = {
  conversations: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.conversationsList),
    create: () => ipcRenderer.invoke(IPC_CHANNELS.conversationsCreate),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.conversationsGet, { id }),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.conversationsDelete, { id }),
  },
  messages: {
    send: (input: SendMessageInput) => ipcRenderer.invoke(IPC_CHANNELS.messagesSend, input),
    retry: (messageId: string) => ipcRenderer.invoke(IPC_CHANNELS.messagesRetry, { messageId }),
  },
  notes: {
    list: (input: ListNotesInput) => ipcRenderer.invoke(IPC_CHANNELS.notesList, input),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.notesGet, { id }),
    save: (input: SaveNoteInput) => ipcRenderer.invoke(IPC_CHANNELS.notesSave, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.notesDelete, { id }),
    exportToObsidian: (id) => ipcRenderer.invoke(IPC_CHANNELS.notesExport, { id }),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    save: (input: SettingsUpdate) => ipcRenderer.invoke(IPC_CHANNELS.settingsSave, input),
    selectVault: () => ipcRenderer.invoke(IPC_CHANNELS.settingsSelectVault),
  },
  tts: {
    speak: (input: SpeakInput) => ipcRenderer.invoke(IPC_CHANNELS.ttsSpeak, input),
  },
  attachments: {
    pickImages: () => ipcRenderer.invoke(IPC_CHANNELS.attachmentsPick),
    read: (id) => ipcRenderer.invoke(IPC_CHANNELS.attachmentsRead, { id }),
  },
}

contextBridge.exposeInMainWorld('japaneseAssistant', api)
