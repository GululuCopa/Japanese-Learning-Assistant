import { createHash } from 'node:crypto'

export function audioCacheKey(input: {
  provider: string
  model: string
  voice: string
  text: string
  speed?: number
  voiceGender?: string
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        provider: input.provider,
        model: input.model,
        voice: input.voice,
        voiceGender: input.voiceGender,
        speed: input.speed ?? 1,
        text: input.text,
      }),
    )
    .digest('hex')
}
