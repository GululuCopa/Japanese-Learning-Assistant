import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../../src/renderer/App'
import { ApiProvider } from '../../src/renderer/state/api'
import type { ConversationDetail } from '../../src/shared/types'
import { kamauAnalysis, miniPngImage } from '../fixtures/prd-cases'
import { createFakeApi } from '../helpers/fake-api'

HTMLMediaElement.prototype.play = vi.fn(async () => undefined)

const pngBytes = Buffer.from(miniPngImage('game.png').dataBase64, 'base64')
File.prototype.arrayBuffer = async function arrayBuffer() {
  return pngBytes.buffer.slice(pngBytes.byteOffset, pngBytes.byteOffset + pngBytes.byteLength)
}
URL.createObjectURL = vi.fn(() => 'blob:test-game-png')
URL.revokeObjectURL = vi.fn()

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

describe('chat tab continuity', () => {
  it('keeps image, text, pending, and analysis across Notes and back', async () => {
    const user = userEvent.setup()
    const { api, releaseSend } = createFakeApi({ holdSend: true })
    api.attachments.pickImages = vi.fn(async () => [miniPngImage('game.png')])
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    )

    await user.click(await screen.findByRole('button', { name: '选择图片' }))
    await user.type(screen.getByLabelText('消息输入'), '这句话什么意思？')
    await user.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('这句话什么意思？')).toBeInTheDocument()
    expect(screen.getByAltText('game.png')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('正在分析…')

    await user.click(screen.getByRole('button', { name: '笔记' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '发送' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '对话' }))
    expect(screen.getByText('这句话什么意思？')).toBeInTheDocument()
    expect(screen.getByAltText('game.png')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('正在分析…')

    await act(async () => {
      releaseSend()
    })
    expect(await screen.findByText('别管我')).toBeInTheDocument()
    expect(screen.getByText('構う')).toBeInTheDocument()
    expect(screen.getByAltText('game.png')).toBeInTheDocument()
  })

  it('does not show the previous conversation pending on another History item', async () => {
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
    expect(screen.getByRole('status')).toHaveTextContent('正在分析…')

    await user.click(screen.getByRole('button', { name: '历史' }))
    await user.click(await screen.findByRole('button', { name: /俺に構うな/ }))
    expect(await screen.findByText('别管我')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await act(async () => {
      releaseSend()
    })
    expect(screen.getByText('别管我')).toBeInTheDocument()
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })
})
