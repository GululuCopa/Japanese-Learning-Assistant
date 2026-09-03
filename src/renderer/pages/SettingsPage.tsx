import { useEffect, useState } from 'react'
import { SYSTEM_TTS_TEST_TEXT } from '@shared/constants'
import type { PublicSettings, VoiceGender } from '@shared/types'
import { StatusBanner } from '../components/StatusBanner'
import { playSpeakResult } from '../play-audio'
import { useApi } from '../state/api'

export function SettingsPage({ onSaved }: { onSaved: (settings: PublicSettings) => void }) {
  const api = useApi()
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female')
  const [obsidianVaultPath, setObsidianVaultPath] = useState('')
  const [current, setCurrent] = useState<PublicSettings | null>(null)
  const [message, setMessage] = useState('')
  const [ttsState, setTtsState] = useState<'idle' | 'loading'>('idle')
  const [ttsError, setTtsError] = useState('')

  useEffect(() => {
    void api.settings.get().then((settings) => {
      setCurrent(settings)
      setAiBaseUrl(settings.aiBaseUrl)
      setAiModel(settings.aiModel)
      setVoiceGender(settings.voiceGender)
      setObsidianVaultPath(settings.obsidianVaultPath)
    })
  }, [api])

  async function testPronunciation() {
    setTtsState('loading')
    setTtsError('')
    try {
      const result = await api.tts.speak({ text: SYSTEM_TTS_TEST_TEXT, speed: 1 })
      await playSpeakResult(result, 1)
      setTtsState('idle')
    } catch (error) {
      setTtsState('idle')
      setTtsError(error instanceof Error ? error.message : '发音失败')
    }
  }

  return (
    <div className="page">
      {current?.encryptionWarning ? (
        <StatusBanner tone="error">{current.encryptionWarning}</StatusBanner>
      ) : null}
      {message ? <StatusBanner>{message}</StatusBanner> : null}
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault()
          const saved = await api.settings.save({
            aiBaseUrl,
            aiModel,
            aiApiKey: aiApiKey || undefined,
            voiceGender,
            obsidianVaultPath,
            responseLanguage: 'zh-CN',
          })
          setCurrent(saved)
          setAiApiKey('')
          setMessage('设置已保存')
          onSaved(saved)
        }}
      >
        <h2>AI</h2>
        <label>
          AI 接口地址
          <input
            value={aiBaseUrl}
            onChange={(event) => setAiBaseUrl(event.target.value)}
            name="aiBaseUrl"
          />
        </label>
        <label>
          AI 模型
          <input
            value={aiModel}
            onChange={(event) => setAiModel(event.target.value)}
            name="aiModel"
          />
        </label>
        <label>
          AI API Key {current?.hasAiApiKey ? '(已保存)' : ''}
          <input
            type="password"
            value={aiApiKey}
            onChange={(event) => setAiApiKey(event.target.value)}
            name="aiApiKey"
            autoComplete="off"
          />
        </label>
        <h2>发音</h2>
        <p className="muted">
          发音使用本机已安装的 Windows / macOS 日语系统语音，无需容器、语音模型或 TTS API
          Key。点击单句发音时才会生成音频。
        </p>
        <fieldset>
          <legend>语音</legend>
          <label>
            <input
              type="radio"
              name="voiceGender"
              value="female"
              checked={voiceGender === 'female'}
              onChange={() => setVoiceGender('female')}
            />
            女声
          </label>
          <label>
            <input
              type="radio"
              name="voiceGender"
              value="male"
              checked={voiceGender === 'male'}
              onChange={() => setVoiceGender('male')}
            />
            男声
          </label>
        </fieldset>
        <div className="toolbar">
          <button
            type="button"
            className="ghost"
            disabled={ttsState === 'loading'}
            onClick={() => void testPronunciation()}
          >
            {ttsState === 'loading' ? '正在生成…' : '测试发音'}
          </button>
        </div>
        {ttsError ? (
          <p className="tts-error" role="alert">
            {ttsError}
          </p>
        ) : null}
        <h2>Obsidian</h2>
        <label>
          Vault Path
          <input
            value={obsidianVaultPath}
            onChange={(event) => setObsidianVaultPath(event.target.value)}
            name="obsidianVaultPath"
            placeholder="D:\Obsidian\MyVault"
          />
        </label>
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            const selected = await api.settings.selectVault()
            if (selected) setObsidianVaultPath(selected)
          }}
        >
          选择文件夹
        </button>
        <p className="muted">回答语言固定为简体中文。API Key 不会出现在日志或界面回显中。</p>
        <button className="primary" type="submit">
          保存设置
        </button>
      </form>
    </div>
  )
}
