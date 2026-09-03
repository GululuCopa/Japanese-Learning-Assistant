import { useEffect, useState } from 'react'
import {
  DEFAULT_MINIMAX_FEMALE_VOICE,
  DEFAULT_MINIMAX_MALE_VOICE,
  DEFAULT_MINIMAX_MODEL,
  MINIMAX_FEMALE_VOICES,
  MINIMAX_MALE_VOICES,
  MINIMAX_MODELS,
  SYSTEM_TTS_TEST_TEXT,
} from '@shared/constants'
import type { MiniMaxRegion, PublicSettings, TTSProviderKind, VoiceGender } from '@shared/types'
import { StatusBanner } from '../components/StatusBanner'
import { playSpeakResult } from '../play-audio'
import { useApi } from '../state/api'

const FEMALE_VOICE_LABELS: Record<(typeof MINIMAX_FEMALE_VOICES)[number], string> = {
  Japanese_CalmLady: 'Calm Lady',
  Japanese_KindLady: 'Kind Lady',
  Japanese_DependableWoman: 'Dependable Woman',
  Japanese_GracefulMaiden: 'Graceful Maiden',
  Japanese_DecisivePrincess: 'Decisive Princess',
  Japanese_ColdQueen: 'Cold Queen',
}

const MALE_VOICE_LABELS: Record<(typeof MINIMAX_MALE_VOICES)[number], string> = {
  Japanese_GentleButler: 'Gentle Butler',
  Japanese_IntellectualSenior: 'Intellectual Senior',
  Japanese_LoyalKnight: 'Loyal Knight',
  Japanese_DominantMan: 'Dominant Man',
  Japanese_SeriousCommander: 'Serious Commander',
  Japanese_OptimisticYouth: 'Optimistic Youth',
  Japanese_GenerousIzakayaOwner: 'Generous Izakaya Owner',
  Japanese_SportyStudent: 'Sporty Student',
  Japanese_InnocentBoy: 'Innocent Boy',
}

export function SettingsPage({ onSaved }: { onSaved: (settings: PublicSettings) => void }) {
  const api = useApi()
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [voiceGender, setVoiceGender] = useState<VoiceGender>('female')
  const [ttsProvider, setTtsProvider] = useState<TTSProviderKind>('system')
  const [minimaxRegion, setMinimaxRegion] = useState<MiniMaxRegion>('china')
  const [minimaxModel, setMinimaxModel] = useState<string>(DEFAULT_MINIMAX_MODEL)
  const [minimaxFemaleVoice, setMinimaxFemaleVoice] = useState<string>(DEFAULT_MINIMAX_FEMALE_VOICE)
  const [minimaxMaleVoice, setMinimaxMaleVoice] = useState<string>(DEFAULT_MINIMAX_MALE_VOICE)
  const [minimaxApiKey, setMinimaxApiKey] = useState('')
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
      setTtsProvider(settings.ttsProvider)
      setMinimaxRegion(settings.minimaxRegion)
      setMinimaxModel(settings.minimaxModel)
      setMinimaxFemaleVoice(settings.minimaxFemaleVoice)
      setMinimaxMaleVoice(settings.minimaxMaleVoice)
      setObsidianVaultPath(settings.obsidianVaultPath)
    })
  }, [api])

  async function persistSettings(): Promise<PublicSettings> {
    const saved = await api.settings.save({
      aiBaseUrl,
      aiModel,
      aiApiKey: aiApiKey || undefined,
      voiceGender,
      ttsProvider,
      minimaxRegion,
      minimaxModel,
      minimaxFemaleVoice,
      minimaxMaleVoice,
      minimaxApiKey: minimaxApiKey || undefined,
      obsidianVaultPath,
      responseLanguage: 'zh-CN',
    })
    setCurrent(saved)
    setAiApiKey('')
    setMinimaxApiKey('')
    onSaved(saved)
    return saved
  }

  async function testPronunciation() {
    setTtsState('loading')
    setTtsError('')
    try {
      await persistSettings()
      const result = await api.tts.speak({
        text: SYSTEM_TTS_TEST_TEXT,
        speed: 1,
        voiceGender,
      })
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
          await persistSettings()
          setMessage('设置已保存')
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
          <legend>语音提供商</legend>
          <label>
            <input
              type="radio"
              name="ttsProvider"
              value="system"
              checked={ttsProvider === 'system'}
              onChange={() => setTtsProvider('system')}
            />
            系统语音
          </label>
          <label>
            <input
              type="radio"
              name="ttsProvider"
              value="minimax"
              checked={ttsProvider === 'minimax'}
              onChange={() => setTtsProvider('minimax')}
            />
            MiniMax
          </label>
        </fieldset>
        {ttsProvider === 'system' ? (
          <p className="muted">
            发音使用本机已安装的 Windows / macOS 日语系统语音，无需容器、语音模型或 TTS API
            Key。点击单句发音时才会生成音频。
          </p>
        ) : (
          <div className="tts-minimax">
            <p className="muted">
              MiniMax 按官方 T2A 接口计费。请勿将 Token Plan 凭证与普通 API Key
              混用。选错区域或凭证会导致鉴权失败。
            </p>
            <p className="muted">MiniMax 发音失败时不会自动切换到系统语音或其他付费服务。</p>
            <label>
              MiniMax API Key {current?.hasMinimaxApiKey ? '(已保存)' : ''}
              <input
                type="password"
                value={minimaxApiKey}
                onChange={(event) => setMinimaxApiKey(event.target.value)}
                name="minimaxApiKey"
                autoComplete="off"
              />
            </label>
            <label>
              区域
              <select
                name="minimaxRegion"
                value={minimaxRegion}
                onChange={(event) => setMinimaxRegion(event.target.value as MiniMaxRegion)}
              >
                <option value="china">国内</option>
                <option value="global">海外</option>
              </select>
            </label>
            <label>
              模型
              <select
                name="minimaxModel"
                value={minimaxModel}
                onChange={(event) => setMinimaxModel(event.target.value)}
              >
                {MINIMAX_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                    {model === DEFAULT_MINIMAX_MODEL ? '（默认）' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              女声音色
              <select
                name="minimaxFemaleVoice"
                value={minimaxFemaleVoice}
                onChange={(event) => setMinimaxFemaleVoice(event.target.value)}
              >
                {MINIMAX_FEMALE_VOICES.map((voice) => (
                  <option key={voice} value={voice}>
                    {FEMALE_VOICE_LABELS[voice]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              男声音色
              <select
                name="minimaxMaleVoice"
                value={minimaxMaleVoice}
                onChange={(event) => setMinimaxMaleVoice(event.target.value)}
              >
                {MINIMAX_MALE_VOICES.map((voice) => (
                  <option key={voice} value={voice}>
                    {MALE_VOICE_LABELS[voice]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
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
            {ttsState === 'loading' ? '正在生成…' : '保存并测试发音'}
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
