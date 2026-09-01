import { useEffect, useState } from 'react'
import type { PublicSettings, VoiceGender } from '@shared/types'
import { StatusBanner } from '../components/StatusBanner'
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

  useEffect(() => {
    void api.settings.get().then((settings) => {
      setCurrent(settings)
      setAiBaseUrl(settings.aiBaseUrl)
      setAiModel(settings.aiModel)
      setVoiceGender(settings.voiceGender)
      setObsidianVaultPath(settings.obsidianVaultPath)
    })
  }, [api])

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
        <p className="muted">
          发音由本地 Kokoro 完成，但需安装 runtime/model。无需填写远程 TTS 地址或 API Key。
        </p>
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
