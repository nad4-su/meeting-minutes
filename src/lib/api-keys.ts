import {
  isProviderId,
  type ProviderId,
  type ProviderSettings,
  type TranscriptionSettings,
} from './providers'

/**
 * Gemini API 키 해석 우선순위:
 * 1) 요청 body로 전달된 키 (브라우저 LocalStorage에서 옴)
 * 2) process.env.GEMINI_API_KEY (서버 환경변수 fallback)
 * 3) null
 */
export function resolveGeminiApiKey(
  requestApiKey?: string | null | undefined,
): string | null {
  const fromRequest = typeof requestApiKey === 'string' ? requestApiKey.trim() : ''
  if (fromRequest.length > 0) return fromRequest

  const fromEnv = (process.env.GEMINI_API_KEY ?? '').trim()
  if (fromEnv.length > 0) return fromEnv

  return null
}

export function isEnvKeyConfigured(): boolean {
  return (process.env.GEMINI_API_KEY ?? '').trim().length > 0
}

/** LLM_* 환경변수로 프로바이더가 지정되어 있는지 */
export function isEnvProviderConfigured(): boolean {
  const provider = env('LLM_PROVIDER')
  if (provider === 'openai-compatible') {
    return env('LLM_BASE_URL').length > 0 && env('LLM_MODEL').length > 0
  }
  return isEnvKeyConfigured() || env('LLM_API_KEY').length > 0
}

export interface ProviderRequestBody {
  provider?: unknown
  apiKey?: unknown
  baseUrl?: unknown
  model?: unknown
}

/**
 * 요청 body + 환경변수로부터 프로바이더 설정을 만든다.
 * 필드별 우선순위는 기존 키 해석과 동일하게 "요청 → 환경변수" 순이다.
 *
 * 사용 가능한 설정이 없으면 null을 돌려주고, 호출부는 단순 변환으로 폴백한다.
 */
export function resolveProviderSettings(
  body: ProviderRequestBody | null | undefined,
): ProviderSettings | null {
  const provider = resolveProvider(body?.provider)

  if (provider === 'gemini') {
    const apiKey = resolveGeminiApiKey(str(body?.apiKey) || env('LLM_API_KEY'))
    if (!apiKey) return null
    return {
      provider,
      apiKey,
      model: str(body?.model) || env('LLM_MODEL') || undefined,
    }
  }

  const baseUrl = str(body?.baseUrl) || env('LLM_BASE_URL')
  const model = str(body?.model) || env('LLM_MODEL')
  if (baseUrl.length === 0 || model.length === 0) return null

  // 로컬 모델 서버는 키가 없어도 되므로 빈 문자열을 허용한다.
  return {
    provider,
    apiKey: str(body?.apiKey) || env('LLM_API_KEY'),
    baseUrl,
    model,
  }
}

function resolveProvider(requested: unknown): ProviderId {
  if (isProviderId(requested)) return requested

  const fromEnv = env('LLM_PROVIDER')
  if (isProviderId(fromEnv)) return fromEnv

  return 'gemini'
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function env(name: string): string {
  return (process.env[name] ?? '').trim()
}

export interface TranscriptionRequestBody extends ProviderRequestBody {
  sttModel?: unknown
}

/**
 * 전사용 프로바이더 설정.
 *
 * 요약과 달리 대화 모델 이름이 없어도 된다. 전사는 `sttModel`(비우면 프로바이더
 * 기본값)로 별도 엔드포인트를 호출하므로, 대화 모델을 지정하지 않은 사용자도
 * 전사는 쓸 수 있어야 한다.
 */
export function resolveTranscriptionSettings(
  body: TranscriptionRequestBody | null | undefined,
): TranscriptionSettings | null {
  const provider = resolveProvider(body?.provider)
  const sttModel = str(body?.sttModel) || env('LLM_STT_MODEL')

  if (provider === 'gemini') {
    const apiKey = resolveGeminiApiKey(str(body?.apiKey) || env('LLM_API_KEY'))
    if (!apiKey) return null
    return { provider, apiKey, sttModel: sttModel || undefined }
  }

  const baseUrl = str(body?.baseUrl) || env('LLM_BASE_URL')
  if (baseUrl.length === 0) return null

  return {
    provider,
    apiKey: str(body?.apiKey) || env('LLM_API_KEY'),
    baseUrl,
    model: str(body?.model) || env('LLM_MODEL'),
    sttModel: sttModel || undefined,
  }
}
