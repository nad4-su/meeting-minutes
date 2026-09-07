import type {
  CompletionOptions,
  CompletionResult,
  ProviderSettings,
} from './types'

/**
 * base URL 검증.
 *
 * 이 값은 사용자가 설정 화면에서 입력하고 서버(Route Handler)가 그대로 fetch 하므로,
 * http/https 이외의 스킴은 거부한다. 앱을 localhost 밖으로 노출한다면
 * SECURITY.md의 "외부 엔드포인트" 항목을 먼저 확인할 것.
 */
export function normalizeBaseUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (trimmed.length === 0) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  return trimmed
}

/**
 * OpenAI Chat Completions 호환 엔드포인트 호출.
 * OrcaRouter · OpenAI · Ollama · LM Studio · vLLM 등이 모두 이 형식을 따른다.
 */
export async function completeWithOpenAICompatible(
  prompt: string,
  settings: ProviderSettings,
  options: CompletionOptions = {},
): Promise<CompletionResult> {
  const { fetchFn = fetch } = options

  const baseUrl = normalizeBaseUrl(settings.baseUrl ?? '')
  if (!baseUrl) {
    return {
      success: false,
      error: 'API 주소(base URL)가 올바르지 않습니다. http:// 또는 https:// 로 시작해야 합니다.',
    }
  }

  const model = settings.model?.trim() ?? ''
  if (model.length === 0) {
    return { success: false, error: '모델 이름이 필요합니다.' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // 로컬 모델 서버(Ollama/LM Studio)는 키 없이 동작하므로 키가 없어도 호출한다.
  //
  // NOTE: 일부 라우터는 "이 요청이 어느 앱에서 왔는지" 식별하는 헤더를 받는다
  // (OpenRouter의 HTTP-Referer / X-Title 등). 특정 서비스와 제휴해 트래픽을
  // 귀속시키려면 그 서비스가 공식 문서로 밝힌 헤더를 여기에 추가하면 된다.
  // 문서화되지 않은 헤더를 추측해서 보내지는 않는다.
  const apiKey = settings.apiKey.trim()
  if (apiKey.length > 0) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  try {
    const response = await fetchFn(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    })

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: 'API 요청 한도 초과. 잠시 후 자동 재시도됩니다.',
          rateLimited: true,
        }
      }
      return { success: false, error: describeHttpError(response.status) }
    }

    const data = await response.json()
    const text: string = data?.choices?.[0]?.message?.content ?? ''

    return { success: true, text }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return { success: false, error: `API 호출 중 오류: ${message}` }
  }
}

function describeHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return `인증에 실패했습니다 (${status}). API 키를 확인해주세요.`
  }
  if (status === 404) {
    return `엔드포인트를 찾을 수 없습니다 (404). base URL과 모델 이름을 확인해주세요.`
  }
  if (status === 402) {
    return '크레딧이 부족합니다 (402). 프로바이더 잔액을 확인해주세요.'
  }
  return `API 호출 실패: ${status}`
}
