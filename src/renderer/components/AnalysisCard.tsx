import { useState } from 'react'
import { grammarSaveItem, vocabularySaveItem } from '@shared/save-payload'
import type { ChatMessage, GrammarItem, JapaneseAnalysis, VocabularyItem } from '@shared/types'
import { playSpeakResult } from '../play-audio'
import { useApi } from '../state/api'

export function AnalysisCard({
  message,
  onSaved,
}: {
  message: ChatMessage
  onSaved?: () => Promise<void> | void
}) {
  const analysis = message.analysis
  if (!analysis) return null
  const screenshotId = messageScreenshot(message)

  return (
    <article className="card" aria-label="日语分析卡片">
      <p className="original">{analysis.original}</p>
      {analysis.reading ? <p className="reading">{analysis.reading}</p> : null}
      <TtsButtons text={analysis.original} />
      <p>{analysis.translation}</p>
      {analysis.literalTranslation ? (
        <p className="muted">字面：{analysis.literalTranslation}</p>
      ) : null}
      {analysis.explanation ? <p>{analysis.explanation}</p> : null}
      <SaveSentence analysis={analysis} screenshotId={screenshotId} onSaved={onSaved} />

      <section className="item-grid" aria-label="词汇">
        {analysis.vocabulary.map((item) => (
          <VocabBlock
            key={`${item.surface}-${item.reading}`}
            item={item}
            analysis={analysis}
            screenshotId={screenshotId}
            onSaved={onSaved}
          />
        ))}
      </section>

      <section className="item-grid" aria-label="文法">
        {analysis.grammar.map((item) => (
          <GrammarBlock
            key={item.pattern}
            item={item}
            analysis={analysis}
            screenshotId={screenshotId}
            onSaved={onSaved}
          />
        ))}
      </section>

      {analysis.tone ? (
        <p>
          语气：
          {analysis.tone.description ||
            [analysis.tone.register, analysis.tone.genderStyle].filter(Boolean).join(' / ')}
        </p>
      ) : null}
      {analysis.learningPoints.map((point) => (
        <p key={point.text}>
          {point.title ? <strong>{point.title}：</strong> : null}
          {point.text}
        </p>
      ))}
    </article>
  )
}

function VocabBlock({
  item,
  analysis,
  screenshotId,
  onSaved,
}: {
  item: VocabularyItem
  analysis: JapaneseAnalysis
  screenshotId?: string
  onSaved?: () => Promise<void> | void
}) {
  const api = useApi()
  return (
    <div className="item">
      <strong>{item.surface}</strong>
      <div className="muted">{item.reading}</div>
      <div>{item.meaning.join(' / ')}</div>
      {item.partOfSpeech ? <div className="muted">{item.partOfSpeech}</div> : null}
      {item.explanation ? <p>{item.explanation}</p> : null}
      {item.example ? (
        <p className="muted">
          {item.example.text} {item.example.translation}
        </p>
      ) : null}
      <div className="toolbar">
        <TtsButtons text={item.surface} />
        {item.recommendedToSave ? <span className="recommend">推荐收藏</span> : null}
        {item.alreadySaved ? (
          <span className="saved">已收藏</span>
        ) : (
          <button
            type="button"
            className="ghost"
            onClick={async () => {
              await api.notes.save({
                kind: 'word',
                item: vocabularySaveItem(item),
                originalSentence: analysis.original,
                translation: analysis.translation,
                screenshotAttachmentId: screenshotId,
              })
              await onSaved?.()
            }}
          >
            收藏
          </button>
        )}
      </div>
    </div>
  )
}

function GrammarBlock({
  item,
  analysis,
  screenshotId,
  onSaved,
}: {
  item: GrammarItem
  analysis: JapaneseAnalysis
  screenshotId?: string
  onSaved?: () => Promise<void> | void
}) {
  const api = useApi()
  return (
    <div className="item">
      <strong>{item.pattern}</strong>
      <div>{item.meaning}</div>
      <p>{item.explanation}</p>
      {item.alreadySaved ? (
        <span className="saved">已收藏</span>
      ) : (
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            await api.notes.save({
              kind: 'grammar',
              item: grammarSaveItem(item),
              originalSentence: analysis.original,
              translation: analysis.translation,
              screenshotAttachmentId: screenshotId,
            })
            await onSaved?.()
          }}
        >
          收藏
        </button>
      )}
    </div>
  )
}

function SaveSentence({
  analysis,
  screenshotId,
  onSaved,
}: {
  analysis: JapaneseAnalysis
  screenshotId?: string
  onSaved?: () => Promise<void> | void
}) {
  const api = useApi()
  return analysis.sentenceAlreadySaved ? (
    <div className="saved">句子已收藏</div>
  ) : (
    <button
      type="button"
      className="ghost"
      onClick={async () => {
        await api.notes.save({
          kind: 'sentence',
          original: analysis.original,
          reading: analysis.reading,
          translation: analysis.translation,
          screenshotAttachmentId: screenshotId,
        })
        await onSaved?.()
      }}
    >
      收藏句子
    </button>
  )
}

function TtsButtons({ text }: { text: string }) {
  const api = useApi()
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function play(speed: 0.75 | 1) {
    setState('loading')
    setMessage('')
    try {
      const result = await api.tts.speak({ text, speed })
      await playSpeakResult(result, speed)
      setState('idle')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : '发音失败')
    }
  }

  return (
    <div className="toolbar">
      <button
        type="button"
        className="ghost"
        disabled={state === 'loading'}
        onClick={() => play(0.75)}
        aria-label={`${text} 0.75 倍速发音`}
      >
        {state === 'loading' ? '生成中…' : '0.75x'}
      </button>
      <button
        type="button"
        className="ghost"
        disabled={state === 'loading'}
        onClick={() => play(1)}
        aria-label={`${text} 1.0 倍速发音`}
      >
        1.0x
      </button>
      {state === 'error' ? <span className="muted">{message}</span> : null}
    </div>
  )
}

function messageScreenshot(message: ChatMessage): string | undefined {
  const image = message.content.find((part) => part.type === 'image')
  return image && image.type === 'image' ? image.attachmentId : undefined
}
