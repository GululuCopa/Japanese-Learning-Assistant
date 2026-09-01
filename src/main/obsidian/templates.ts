import { toPosixRel } from './paths'
import type { NoteRecord } from '@shared/types'

function yamlScalar(value: string): string {
  if (value.includes('\n') || value.includes(':') || value.includes('#') || /["']/.test(value)) {
    return JSON.stringify(value)
  }
  return value
}

function yamlList(values: string[]): string {
  if (values.length === 0) return '[]'
  return `\n${values.map((item) => `  - ${yamlScalar(item)}`).join('\n')}`
}

export function noteMarkdown(note: NoteRecord, assetRelPosix?: string): string {
  const created = note.createdAt.slice(0, 10)
  if (note.kind === 'word') {
    const reading = String(note.payload.reading ?? '')
    const meaning = Array.isArray(note.payload.meaning) ? (note.payload.meaning as string[]) : []
    const explanation = String(note.payload.explanation ?? '')
    const partOfSpeech = String(note.payload.partOfSpeech ?? '')
    const tags = ['japanese']
    if (partOfSpeech) tags.push(partOfSpeech)
    return (
      [
        '---',
        'type: japanese-word',
        `reading: ${yamlScalar(reading)}`,
        `created: ${created}`,
        `tags:${yamlList(tags)}`,
        '---',
        '',
        `# ${note.title}`,
        '',
        '## Reading',
        '',
        reading,
        '',
        '## Meaning',
        '',
        meaning.join('、') + (meaning.length ? '。' : ''),
        '',
        note.originalSentence
          ? ['## Context', '', `> ${note.originalSentence}`, '', note.translation ?? '', ''].join(
              '\n',
            )
          : '',
        explanation ? ['## Explanation', '', explanation, ''].join('\n') : '',
        assetRelPosix ? ['## Source', '', `![[${assetRelPosix}]]`, ''].join('\n') : '',
      ]
        .filter((block) => block !== '')
        .join('\n')
        .trimEnd() + '\n'
    )
  }

  if (note.kind === 'sentence') {
    const reading = String(note.payload.reading ?? '')
    return (
      [
        '---',
        'type: japanese-sentence',
        `created: ${created}`,
        'tags:',
        '  - japanese',
        '  - sentence',
        '---',
        '',
        `# ${note.title}`,
        '',
        '## Reading',
        '',
        reading,
        '',
        '## Translation',
        '',
        note.translation ?? '',
        '',
        assetRelPosix ? ['## Source', '', `![[${assetRelPosix}]]`, ''].join('\n') : '',
      ]
        .filter((block) => block !== '')
        .join('\n')
        .trimEnd() + '\n'
    )
  }

  const meaning = String(note.payload.meaning ?? '')
  const explanation = String(note.payload.explanation ?? '')
  return (
    [
      '---',
      'type: japanese-grammar',
      `created: ${created}`,
      'tags:',
      '  - japanese',
      '  - grammar',
      '---',
      '',
      `# ${note.title}`,
      '',
      '## Meaning',
      '',
      meaning,
      '',
      explanation ? ['## Explanation', '', explanation, ''].join('\n') : '',
      note.originalSentence
        ? ['## Example', '', `> ${note.originalSentence}`, '', note.translation ?? '', ''].join(
            '\n',
          )
        : '',
      assetRelPosix ? ['## Source', '', `![[${assetRelPosix}]]`, ''].join('\n') : '',
    ]
      .filter((block) => block !== '')
      .join('\n')
      .trimEnd() + '\n'
  )
}

export function assetEmbedPath(fileName: string): string {
  return toPosixRel(['..', 'Assets', fileName])
}
