import type { AnalyzeRequest, AudioResult, JapaneseAnalysis, TTSOptions } from './types'

export interface AIProvider {
  analyze(request: AnalyzeRequest): Promise<JapaneseAnalysis>
}

export interface TTSProvider {
  speak(text: string, options?: TTSOptions): Promise<AudioResult>
}
