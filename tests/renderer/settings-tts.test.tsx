import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SYSTEM_TTS_TEST_TEXT } from '../../src/shared/constants'
import { SettingsPage } from '../../src/renderer/pages/SettingsPage'
import { ApiProvider } from '../../src/renderer/state/api'
import { createFakeApi } from '../helpers/fake-api'

HTMLMediaElement.prototype.play = vi.fn(async () => undefined)
URL.createObjectURL = vi.fn(() => 'blob:jla-tts-test')
URL.revokeObjectURL = vi.fn()

describe('settings system TTS', () => {
  it('keeps male/female, explains system voices, and hides MiniMax until selected', async () => {
    render(
      <ApiProvider api={createFakeApi().api}>
        <SettingsPage onSaved={() => undefined} />
      </ApiProvider>,
    )

    expect(await screen.findByRole('radio', { name: '女声' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '男声' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '系统语音' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'MiniMax' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存并测试发音' })).toBeInTheDocument()
    expect(screen.getByText(/Windows \/ macOS 日语系统语音/)).toBeInTheDocument()
    expect(screen.getByText(/无需容器、语音模型或 TTS API Key/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '一键安装语音引擎' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Kokoro/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('TTS 接口地址')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('TTS 模型')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('TTS Voice')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/TTS API Key/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/MiniMax API Key/)).not.toBeInTheDocument()
  })

  it('saves current gender then previews with a voiceGender override', async () => {
    const user = userEvent.setup()
    const { api } = createFakeApi()
    render(
      <ApiProvider api={api}>
        <SettingsPage onSaved={() => undefined} />
      </ApiProvider>,
    )

    await user.click(await screen.findByRole('radio', { name: '男声' }))
    await user.click(screen.getByRole('button', { name: '保存并测试发音' }))
    await waitFor(() =>
      expect(api.settings.save).toHaveBeenCalledWith(
        expect.objectContaining({ voiceGender: 'male', ttsProvider: 'system' }),
      ),
    )
    expect(api.tts.speak).toHaveBeenCalledWith({
      text: SYSTEM_TTS_TEST_TEXT,
      speed: 1,
      voiceGender: 'male',
    })

    await user.click(screen.getByRole('radio', { name: '女声' }))
    await user.click(screen.getByRole('button', { name: '保存并测试发音' }))
    await waitFor(() =>
      expect(api.tts.speak).toHaveBeenLastCalledWith({
        text: SYSTEM_TTS_TEST_TEXT,
        speed: 1,
        voiceGender: 'female',
      }),
    )
  })

  it('shows MiniMax controls only after MiniMax is selected', async () => {
    const user = userEvent.setup()
    render(
      <ApiProvider api={createFakeApi().api}>
        <SettingsPage onSaved={() => undefined} />
      </ApiProvider>,
    )

    await user.click(await screen.findByRole('radio', { name: 'MiniMax' }))
    expect(screen.getByLabelText(/MiniMax API Key/)).toBeInTheDocument()
    expect(screen.getByLabelText('区域')).toBeInTheDocument()
    expect(screen.getByLabelText('模型')).toHaveValue('speech-2.8-hd')
    expect(screen.getByLabelText('女声音色')).toHaveValue('Japanese_CalmLady')
    expect(screen.getByLabelText('男声音色')).toHaveValue('Japanese_GentleButler')
    expect(screen.getByText(/Token Plan/)).toBeInTheDocument()
    expect(screen.getByText(/不会自动切换到系统语音/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '区域' })).toHaveDisplayValue('国内')

    await user.click(screen.getByRole('radio', { name: '系统语音' }))
    expect(screen.queryByLabelText(/MiniMax API Key/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('区域')).not.toBeInTheDocument()
  })

  it('shows generating state and an inline actionable error without a stack trace', async () => {
    const user = userEvent.setup()
    const { api } = createFakeApi()
    let finish:
      ((value: { mimeType: string; dataBase64: string; cached: boolean }) => void) | undefined
    api.tts.speak = vi.fn(
      () =>
        new Promise<{ mimeType: string; dataBase64: string; cached: boolean }>((resolve) => {
          finish = resolve
        }),
    )

    render(
      <ApiProvider api={api}>
        <SettingsPage onSaved={() => undefined} />
      </ApiProvider>,
    )

    await user.click(await screen.findByRole('button', { name: '保存并测试发音' }))
    expect(await screen.findByRole('button', { name: '正在生成…' })).toBeDisabled()
    finish?.({
      mimeType: 'audio/wav',
      dataBase64: Buffer.from('RIFF').toString('base64'),
      cached: false,
    })
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled())

    api.tts.speak = vi.fn(async () => {
      throw new Error('未找到 macOS 日语系统语音，请先在系统设置中下载日语语音后重试。')
    })
    await user.click(screen.getByRole('button', { name: '保存并测试发音' }))
    expect(
      await screen.findByText('未找到 macOS 日语系统语音，请先在系统设置中下载日语语音后重试。'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/at SettingsPage/)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'AI 接口地址' })).toBeEnabled()
  })
})
