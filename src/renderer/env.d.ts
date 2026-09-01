import type { JapaneseAssistantAPI } from '@shared/types'

declare global {
  interface Window {
    japaneseAssistant: JapaneseAssistantAPI
  }
}

export {}
