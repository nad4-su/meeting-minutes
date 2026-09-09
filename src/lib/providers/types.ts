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

/* ------------------------------------------------------------------------- *
 * 음성 전사 (STT)
 * ------------------------------------------------------------------------- */

/**
 * 전사할 오디오.
 *
 * 파일 전체를 메모리에 올린다. 회의 하나가 상한(수십 MB) 안에 들어오도록
 * 녹음 비트레이트를 낮춰 두었으므로 스트리밍까지 갈 필요는 없다.
 */
export interface TranscriptionInput {
  bytes: Uint8Array
  mimeType: string
  fileName: string
  /** BCP-47 앞부분. 예: 'ko'. 지정하면 인식 정확도가 눈에 띄게 오른다. */
  language?: string
  /**
   * 어휘 힌트. 참석자 이름·제품명·사내 용어를 넣으면 고유명사 오인식이 준다.
   * Whisper는 이 문자열을 직전 문맥처럼 취급한다(약 224토큰까지).
   */
  vocabularyHint?: string
}

/** 전사 구간. Whisper `verbose_json`이 주는 실제 오디오 타임라인 기준. */
export interface TranscriptionSegment {
  /** 초 단위, 오디오 시작 기준. */
  start: number
  end: number
  text: string
}

export type TranscriptionResult =
  | {
      success: true
      text: string
      /** 프로바이더가 타임스탬프를 주지 않으면 비어 있다. */
      segments: TranscriptionSegment[]
      model: string
    }
  | { success: false; error: string; rateLimited?: boolean }

export interface TranscriptionOptions {
  fetchFn?: typeof fetch
}

/** 전사에 쓸 모델은 대화용 모델과 다르므로 따로 받는다. */
export interface TranscriptionSettings extends ProviderSettings {
  sttModel?: string
}
