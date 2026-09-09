import type {
  CompletionOptions,
  CompletionResult,
  ProviderSettings,
  TranscriptionInput,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionSegment,
  TranscriptionSettings,
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

/** Whisper 계열 기본 모델. OrcaRouter·OpenAI·로컬 whisper.cpp 모두 이 이름을 쓴다. */
export const DEFAULT_OPENAI_STT_MODEL = 'whisper-1'

/**
 * Whisper가 받아주는 컨테이너.
 * 우리 녹음(webm/opus)이 여기 포함되므로 별도 변환 없이 그대로 보낸다.
 */
const WHISPER_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mpga',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
]

export function isWhisperSupportedMimeType(mimeType: string): boolean {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  return WHISPER_MIME_TYPES.includes(base)
}

/**
 * OpenAI `/audio/transcriptions` 호환 엔드포인트로 전사.
 *
 * `verbose_json`을 먼저 요청한다. 구간별 실제 타임스탬프가 같이 오기 때문이다 —
 * Web Speech가 주지 못하던 진짜 오디오 타임라인이며, 화자 분리를 얹으려면
 * 반드시 필요하다. 이 형식을 지원하지 않는 최신 모델(gpt-4o-transcribe 등)은
 * 400을 돌려주므로 그때는 `json`으로 한 번 더 시도한다.
 */
export async function transcribeWithOpenAICompatible(
  input: TranscriptionInput,
  settings: TranscriptionSettings,
  options: TranscriptionOptions = {},
): Promise<TranscriptionResult> {
  const { fetchFn = fetch } = options

  const baseUrl = normalizeBaseUrl(settings.baseUrl ?? '')
  if (!baseUrl) {
    return {
      success: false,
      error: 'API 주소(base URL)가 올바르지 않습니다. http:// 또는 https:// 로 시작해야 합니다.',
    }
  }

  if (!isWhisperSupportedMimeType(input.mimeType)) {
    return {
      success: false,
      error: `이 엔드포인트가 지원하지 않는 오디오 형식입니다 (${input.mimeType}).`,
    }
  }

  const model = settings.sttModel?.trim() || DEFAULT_OPENAI_STT_MODEL

  const headers: Record<string, string> = {}
  const apiKey = settings.apiKey.trim()
  if (apiKey.length > 0) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  // Content-Type은 지정하지 않는다. FormData가 boundary까지 붙여 설정한다.

  async function send(responseFormat: 'verbose_json' | 'json') {
    const form = new FormData()
    form.append(
      'file',
      new Blob([input.bytes as BlobPart], { type: input.mimeType }),
      input.fileName,
    )
    form.append('model', model)
    form.append('response_format', responseFormat)
    if (input.language) form.append('language', input.language)
    if (input.vocabularyHint) form.append('prompt', input.vocabularyHint)

    return fetchFn(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: form,
    })
  }

  try {
    let response = await send('verbose_json')

    // verbose_json 미지원 모델 → 타임스탬프를 포기하고 텍스트만 받는다.
    if (response.status === 400) {
      response = await send('json')
    }

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: '전사 API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
          rateLimited: true,
        }
      }
      return { success: false, error: describeHttpError(response.status) }
    }

    const data = await response.json()
    const text: string = typeof data?.text === 'string' ? data.text : ''

    if (text.trim().length === 0) {
      return {
        success: false,
        error: '전사 결과가 비어 있습니다. 오디오에 음성이 들어 있는지 확인해주세요.',
      }
    }

    return { success: true, text, segments: parseWhisperSegments(data), model }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return { success: false, error: `전사 호출 중 오류: ${message}` }
  }
}

function parseWhisperSegments(data: unknown): TranscriptionSegment[] {
  const raw = (data as { segments?: unknown })?.segments
  if (!Array.isArray(raw)) return []

  const segments: TranscriptionSegment[] = []

  for (const item of raw) {
    const start = Number((item as { start?: unknown })?.start)
    const end = Number((item as { end?: unknown })?.end)
    const text = String((item as { text?: unknown })?.text ?? '').trim()

    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    if (text.length === 0) continue

    segments.push({ start: Math.max(0, start), end: Math.max(start, end), text })
  }

  return segments
}
