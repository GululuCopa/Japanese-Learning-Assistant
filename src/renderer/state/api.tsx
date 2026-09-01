import { createContext, useContext, type ReactNode } from 'react'
import type { JapaneseAssistantAPI } from '@shared/types'

const ApiContext = createContext<JapaneseAssistantAPI | null>(null)

export function ApiProvider({ api, children }: { api: JapaneseAssistantAPI; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}

export function useApi(): JapaneseAssistantAPI {
  const api = useContext(ApiContext)
  if (!api) {
    throw new Error('Japanese assistant API is not available')
  }
  return api
}

export function browserApi(): JapaneseAssistantAPI {
  return window.japaneseAssistant
}
