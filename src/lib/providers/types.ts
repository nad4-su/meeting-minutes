/**
 * LLM 프로바이더 공통 타입.
 *
 * - `gemini`: Google Generative Language API를 직접 호출 (기본값, 기존 동작)
 * - `openai-compatible`: OpenAI Chat Completions 형식을 따르는 모든 엔드포인트
 *   (OrcaRouter, OpenAI, Ollama, LM Studio, vLLM 등)
 */
export type ProviderId = 'gemini' | 'openai-compatible'

export const PROVIDER_IDS: readonly ProviderId[] = ['gemini', 'openai-compatible']

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)
}

export interface ProviderSettings {
  provider: ProviderId
  /** 로컬 모델 서버처럼 인증이 필요 없는 엔드포인트에서는 빈 문자열일 수 있다. */
  apiKey: string
  /** openai-compatible 전용. 예: https://api.orcarouter.ai/v1 */
  baseUrl?: string
  /** 비워두면 프로바이더별 기본 모델을 사용한다. */
  model?: string
}

export type CompletionResult =
  | { success: true; text: string }
  | { success: false; error: string; rateLimited?: boolean }

export interface CompletionOptions {
  fetchFn?: typeof fetch
}
