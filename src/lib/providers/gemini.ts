import type {
  CompletionOptions,
  CompletionResult,
  ProviderSettings,
} from './types'

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models'

export function resolveGeminiModel(model?: string): string {
  const trimmed = model?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : DEFAULT_GEMINI_MODEL
}

/**
 * Google Generative Language API 직접 호출.
 * 키는 URL이 아닌 `x-goog-api-key` 헤더로 보낸다 (로그/리퍼러 유출 방지).
 */
export async function completeWithGemini(
  prompt: string,
  settings: ProviderSettings,
  options: CompletionOptions = {},
): Promise<CompletionResult> {
  const { fetchFn = fetch } = options
  const apiKey = settings.apiKey.trim()

  if (apiKey.length === 0) {
    return { success: false, error: 'Gemini API 키가 필요합니다.' }
  }

  const model = resolveGeminiModel(settings.model)
  const url = `${API_ROOT}/${encodeURIComponent(model)}:generateContent`

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: 'Gemini API 요청 한도 초과. 잠시 후 자동 재시도됩니다.',
          rateLimited: true,
        }
      }
      return { success: false, error: describeHttpError(response.status) }
    }

    const data = await response.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    return { success: true, text }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return { success: false, error: `Gemini API 호출 중 오류: ${message}` }
  }
}

function describeHttpError(status: number): string {
  if (status === 400) {
    return 'Gemini API 오류: 잘못된 요청 또는 키 형식입니다 (400).'
  }
  if (status === 401 || status === 403) {
    return `Gemini API 인증 실패 (${status}). 키를 확인해주세요.`
  }
  return `Gemini API 호출 실패: ${status}`
}
