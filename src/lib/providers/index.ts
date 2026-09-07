import { completeWithGemini, resolveGeminiModel } from './gemini'
import { completeWithOpenAICompatible } from './openai-compatible'
import type {
  CompletionOptions,
  CompletionResult,
  ProviderSettings,
} from './types'

export * from './types'
export * from './presets'
export { DEFAULT_GEMINI_MODEL, resolveGeminiModel } from './gemini'
export { normalizeBaseUrl } from './openai-compatible'

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
