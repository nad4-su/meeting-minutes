import {
  DEFAULT_GEMINI_STT_MODEL,
  completeWithGemini,
  resolveGeminiModel,
  transcribeWithGemini,
} from './gemini'
import {
  DEFAULT_OPENAI_STT_MODEL,
  completeWithOpenAICompatible,
  transcribeWithOpenAICompatible,
} from './openai-compatible'
import type {
  CompletionOptions,
  CompletionResult,
  ProviderSettings,
  TranscriptionInput,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionSettings,
} from './types'

export * from './types'
export * from './presets'
export {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_STT_MODEL,
  GEMINI_INLINE_AUDIO_LIMIT,
  isGeminiSupportedAudioMimeType,
  parseTimestampedTranscript,
  resolveGeminiModel,
} from './gemini'
export {
  DEFAULT_OPENAI_STT_MODEL,
  isWhisperSupportedMimeType,
  normalizeBaseUrl,
} from './openai-compatible'

/**
 * 설정된 프로바이더로 프롬프트 1회 호출.
 * 실패는 예외 대신 `{ success: false }`로 돌려주므로 호출부에서 폴백하기 쉽다.
 */
export async function complete(
  prompt: string,
  settings: ProviderSettings,
  options: CompletionOptions = {},
): Promise<CompletionResult> {
  if (settings.provider === 'openai-compatible') {
    return completeWithOpenAICompatible(prompt, settings, options)
  }
  return completeWithGemini(prompt, settings, options)
}

/** 회의록 하단 문구 등에 쓸 모델 표기. */
export function describeModel(settings: ProviderSettings): string {
  if (settings.provider === 'openai-compatible') {
    return settings.model?.trim() || '알 수 없는 모델'
  }
  return resolveGeminiModel(settings.model)
}

/** provider 설정이 없으면 기존 Gemini 전용 호출부와 동일하게 동작시킨다. */
export function toProviderSettings(
  settings: ProviderSettings | undefined,
  apiKey: string | undefined,
): ProviderSettings {
  return settings ?? { provider: 'gemini', apiKey: apiKey ?? '' }
}

/**
 * 설정된 프로바이더로 오디오 1건 전사.
 *
 * 요약과 마찬가지로 실패를 예외로 던지지 않는다. 전사는 회의가 끝난 뒤
 * 한 번뿐인 기회이므로, 호출부가 오류 문구를 그대로 사용자에게 보여주고
 * 원본 오디오를 내려받도록 안내할 수 있어야 한다.
 */
export async function transcribe(
  input: TranscriptionInput,
  settings: TranscriptionSettings,
  options: TranscriptionOptions = {},
): Promise<TranscriptionResult> {
  if (settings.provider === 'openai-compatible') {
    return transcribeWithOpenAICompatible(input, settings, options)
  }
  return transcribeWithGemini(input, settings, options)
}

/** 전사에 실제로 쓰일 모델 이름. */
export function resolveSttModel(settings: TranscriptionSettings): string {
  const explicit = settings.sttModel?.trim()
  if (explicit) return explicit

  return settings.provider === 'openai-compatible'
    ? DEFAULT_OPENAI_STT_MODEL
    : DEFAULT_GEMINI_STT_MODEL
}
