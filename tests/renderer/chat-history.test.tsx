import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../../src/renderer/App'
import { ChatPage } from '../../src/renderer/pages/ChatPage'
import { ApiProvider } from '../../src/renderer/state/api'
import type { ConversationDetail, PublicSettings } from '../../src/shared/types'
import { kamauAnalysis } from '../fixtures/prd-cases'
import { createFakeApi } from '../helpers/fake-api'

HTMLMediaElement.prototype.play = vi.fn(async () => undefined)

const filledHistory: ConversationDetail = {
  id: 'c-full',
  title: '俺に構うな',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:02.000Z',
  messages: [
    {
      id: 'u-full',
      conversationId: 'c-full',
      role: 'user',
      content: [{ type: 'text', text: '俺に構うな' }],
      createdAt: '2026-09-01T00:00:01.000Z',
    },
    {
      id: 'a-full',
      conversationId: 'c-full',
      role: 'assistant',
      content: [{ type: 'text', text: kamauAnalysis.original }],
      analysis: kamauAnalysis,
      createdAt: '2026-09-01T00:00:02.000Z',
    },
  ],
}

const settings: PublicSettings = {
  aiBaseUrl: 'https://example.test/v1',
  aiModel: 'gpt-test',
  hasAiApiKey: true,
  voiceGender: 'female',
  obsidianVaultPath: '',
  responseLanguage: 'zh-CN',
  encryptionAvailable: true,
}

describe('history conversation open', () => {
  it('loads messages when opening a filled conversation from History', async () => {
    const user = userEvent.setup()
    const { api } = createFakeApi({ historyConversations: [filledHistory] })
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    )

    await user.click(await screen.findByRole('button', { name: '历史' }))
    await user.click(await screen.findByRole('button', { name: /俺に構うな/ }))

    expect(api.conversations.get).toHaveBeenCalledWith('c-full')
    expect(await screen.findByText('别管我')).toBeInTheDocument()
  })

  it('shows an error and not the empty CTA when get rejects', async () => {
    const user = userEvent.setup()
    const { api } = createFakeApi({ historyConversations: [filledHistory], failGet: true })
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    )

    await user.click(await screen.findByRole('button', { name: '历史' }))
    await user.click(await screen.findByRole('button', { name: /俺に構うな/ }))

    expect(await screen.findByText('对话不存在')).toBeInTheDocument()
    expect(screen.queryByText('粘贴一句日语或一张游戏截图，开始学习。')).not.toBeInTheDocument()
  })

  it('skip only applies to the created conversation id; switching to a history id loads', async () => {
    const user = userEvent.setup()
    const { api } = createFakeApi({
      distinctCreate: true,
      historyConversations: [filledHistory],
    })

    function Harness() {
      const [id, setId] = useState<string | null>('c-new')
      return (
        <>
          <button type="button" onClick={() => setId('c-full')}>
            open-full
          </button>
          <ChatPage conversationId={id} settings={settings} onConversationChange={setId} />
        </>
      )
    }

    render(
      <ApiProvider api={api}>
        <Harness />
      </ApiProvider>,
    )

    await user.click(screen.getByRole('button', { name: '新对话' }))
    await user.click(screen.getByRole('button', { name: 'open-full' }))

    await waitFor(() => expect(api.conversations.get).toHaveBeenCalledWith('c-full'))
    expect(await screen.findByText('别管我')).toBeInTheDocument()
  })

  it('keeps History conversation after a deferred send completes', async () => {
    const user = userEvent.setup()
    const { api, releaseSend } = createFakeApi({
      holdSend: true,
      distinctCreate: true,
      historyConversations: [filledHistory],
    })
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    )

    await user.type(await screen.findByLabelText('消息输入'), 'hello')
    await user.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('hello')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '历史' }))
    await user.click(await screen.findByRole('button', { name: /俺に構うな/ }))
    expect(await screen.findByText('别管我')).toBeInTheDocument()

    await act(async () => {
      releaseSend()
    })

    expect(await screen.findByText('别管我')).toBeInTheDocument()
    expect(screen.queryByText('粘贴一句日语或一张游戏截图，开始学习。')).not.toBeInTheDocument()
  })
})
