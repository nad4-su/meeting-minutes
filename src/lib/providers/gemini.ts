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

/**
 * Gemini 오디오 입력 기본 모델.
 * flash-lite는 오디오를 받지 않으므로 요약용 기본값과 다르다.
 */
export const DEFAULT_GEMINI_STT_MODEL = 'gemini-3.6-flash'

/**
 * Gemini가 문서로 밝힌 오디오 형식.
 *
 * **webm은 여기에 없다.** 우리 브라우저 녹음이 webm/opus이므로 Gemini로는
 * 실시간 녹음을 전사할 수 없고, 업로드한 mp3/wav/flac/ogg/m4a만 된다.
 * 녹음 전사는 Whisper 호환 엔드포인트(OrcaRouter·OpenAI·로컬)를 써야 한다.
 */
const GEMINI_AUDIO_MIME_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/x-m4a',
]

export function isGeminiSupportedAudioMimeType(mimeType: string): boolean {
  const base = mimeType.split(';')[0].trim().toLowerCase()
  return GEMINI_AUDIO_MIME_TYPES.includes(base)
}

/**
 * inline_data로 보낼 수 있는 최대 오디오 크기.
 *
 * generateContent 요청 전체가 20MB를 넘으면 안 되는데 base64가 약 4/3배로
 * 부풀리므로, 원본 기준 14MB에서 끊는다. 더 큰 파일은 Files API가 필요하다.
 */
export const GEMINI_INLINE_AUDIO_LIMIT = 14 * 1024 * 1024

function buildTranscriptionPrompt(input: TranscriptionInput): string {
  const lines = [
    '이 오디오는 회의 녹음입니다. 들리는 발화를 그대로 받아쓰세요.',
    '',
    '규칙:',
    '- 요약하거나 문장을 다듬지 말고 말한 그대로 옮깁니다.',
    '- 들리지 않는 구간은 지어내지 말고 건너뜁니다.',
    '- 각 발화 앞에 `[MM:SS]` 형식으로 시작 시각을 붙입니다.',
    '- 설명이나 머리말 없이 전사문만 출력합니다.',
  ]

  if (input.vocabularyHint) {
    lines.push(
      '',
      `이 회의에 나올 수 있는 고유명사·용어: ${input.vocabularyHint}`,
    )
  }

  return lines.join('\n')
}

/** `[MM:SS] 텍스트` 또는 `[HH:MM:SS] 텍스트` 줄을 구간으로 바꾼다. */
export function parseTimestampedTranscript(text: string): TranscriptionSegment[] {
  const segments: TranscriptionSegment[] = []
  const pattern = /^\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]\s*(.+)$/

  for (const line of text.split('\n')) {
    const match = pattern.exec(line.trim())
    if (!match) continue

    const [, h, m, s, body] = match
    const start = (h ? Number(h) * 3600 : 0) + Number(m) * 60 + Number(s)
    const content = body.trim()
    if (content.length === 0) continue

    // 다음 구간이 시작될 때까지가 이 구간이다. 마지막은 뒤에서 채운다.
    if (segments.length > 0) {
      segments[segments.length - 1].end = start
    }
    segments.push({ start, end: start, text: content })
  }

  if (segments.length > 0) {
    const last = segments[segments.length - 1]
    if (last.end <= last.start) last.end = last.start + 1
  }

  return segments
}

/** Gemini에 오디오를 inline으로 실어 전사한다. */
export async function transcribeWithGemini(
  input: TranscriptionInput,
  settings: TranscriptionSettings,
  options: TranscriptionOptions = {},
): Promise<TranscriptionResult> {
  const { fetchFn = fetch } = options
  const apiKey = settings.apiKey.trim()

  if (apiKey.length === 0) {
    return { success: false, error: 'Gemini API 키가 필요합니다.' }
  }

  const baseMime = input.mimeType.split(';')[0].trim().toLowerCase()

  if (!isGeminiSupportedAudioMimeType(input.mimeType)) {
    return {
      success: false,
      error:
        `Gemini는 ${baseMime} 형식을 받지 않습니다. ` +
        '브라우저 녹음(webm)을 전사하려면 설정에서 OpenAI 호환 프로바이더' +
        '(OrcaRouter · OpenAI · 로컬 whisper)를 선택해주세요.',
    }
  }

  if (input.bytes.byteLength > GEMINI_INLINE_AUDIO_LIMIT) {
    return {
      success: false,
      error:
        `오디오가 너무 큽니다 (${Math.round(input.bytes.byteLength / 1024 / 1024)}MB). ` +
        `Gemini 직접 호출은 ${Math.round(GEMINI_INLINE_AUDIO_LIMIT / 1024 / 1024)}MB까지만 가능합니다. ` +
        'OpenAI 호환 프로바이더를 쓰거나 오디오를 나눠주세요.',
    }
  }

  const model = settings.sttModel?.trim() || DEFAULT_GEMINI_STT_MODEL
  const url = `${API_ROOT}/${encodeURIComponent(model)}:generateContent`

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildTranscriptionPrompt(input) },
              {
                inline_data: {
                  mime_type: baseMime,
                  data: Buffer.from(input.bytes).toString('base64'),
                },
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: 'Gemini API 요청 한도 초과. 잠시 후 다시 시도해주세요.',
          rateLimited: true,
        }
      }
      return { success: false, error: describeHttpError(response.status) }
    }

    const data = await response.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (text.trim().length === 0) {
      return {
        success: false,
        error: '전사 결과가 비어 있습니다. 오디오에 음성이 들어 있는지 확인해주세요.',
      }
    }

    return {
      success: true,
      text: text.trim(),
      segments: parseTimestampedTranscript(text),
      model,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return { success: false, error: `전사 호출 중 오류: ${message}` }
  }
}
