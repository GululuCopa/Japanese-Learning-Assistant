import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../../src/renderer/App'
import { ApiProvider } from '../../src/renderer/state/api'
import { createFakeApi } from '../helpers/fake-api'

HTMLMediaElement.prototype.play = vi.fn(async () => undefined)

describe('renderer interactions', () => {
  it('sends Japanese text, renders analysis, and saves 構う', async () => {
    const user = userEvent.setup()
    const { api, notes } = createFakeApi()
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    )

    const input = await screen.findByLabelText('消息输入')
    await user.type(input, '俺に構うな')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('おれに かまうな')).toBeInTheDocument()
    expect(screen.getByText('别管我')).toBeInTheDocument()
    expect(screen.getByText('構う')).toBeInTheDocument()
    expect(screen.getByText('～な')).toBeInTheDocument()
    expect(screen.getAllByText(/冷淡/).length).toBeGreaterThan(0)
    expect(screen.getByText('推荐收藏')).toBeInTheDocument()

    const saveButtons = screen.getAllByRole('button', { name: '收藏' })
    await user.click(saveButtons[1]!)
    await waitFor(() => expect(notes[0]?.title).toBe('構う'))

    await user.click(screen.getByRole('button', { name: '笔记' }))
    expect(await screen.findByRole('heading', { name: '構う' })).toBeInTheDocument()
  })

  it('validates settings and lists history', async () => {
    const user = userEvent.setup()
    const { api } = createFakeApi({ configured: false })
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    )
    expect(await screen.findByText(/请先到设置中填写/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '设置' }))
    await user.type(screen.getByRole('textbox', { name: 'AI 接口地址' }), 'https://example.test/v1')
    expect(screen.queryByLabelText('TTS 接口地址')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('TTS 模型')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('TTS Voice')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/TTS API Key/)).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '女声' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '男声' })).toBeInTheDocument()
    expect(screen.getByText(/需安装 runtime\/model|需自行安装 runtime/)).toBeInTheDocument()
    expect(screen.queryByText(/无需填写远程 TTS 地址/)).not.toBeNull()
    await user.click(screen.getByRole('button', { name: '历史' }))
    expect(screen.queryByRole('button', { name: '新对话' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /9\/1\/2026/ })).toBeInTheDocument()
  })

  it('places 新对话 on Chat and starts a blank conversation', async () => {
    const user = userEvent.setup()
    const { api } = createFakeApi()
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    )
    expect(await screen.findByRole('button', { name: '新对话' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '新对话' }))
    expect(api.conversations.create).toHaveBeenCalled()
  })

  it('shows the user message and waiting state before send resolves', async () => {
    const user = userEvent.setup()
    const { api, releaseSend } = createFakeApi({ holdSend: true })
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    )
    const input = await screen.findByLabelText('消息输入')
    await user.type(input, '俺に構うな')
    await user.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('俺に構うな')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('正在分析…')
    expect(screen.getByLabelText('消息输入')).toHaveValue('')
    releaseSend()
    expect(await screen.findByText('おれに かまうな')).toBeInTheDocument()
  })

  it('keeps a failed outgoing message visible with retry', async () => {
    const user = userEvent.setup()
    const { api } = createFakeApi({ failSend: true })
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    )
    const input = await screen.findByLabelText('消息输入')
    await user.type(input, '俺に構うな')
    await user.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('俺に構うな')).toBeInTheDocument()
    expect(screen.getByText('分析失败')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })
})
