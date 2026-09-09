import { describe, it, expect, vi } from 'vitest'
import {
  isGeminiSupportedAudioMimeType,
  isWhisperSupportedMimeType,
  parseTimestampedTranscript,
  resolveSttModel,
  transcribe,
  GEMINI_INLINE_AUDIO_LIMIT,
  DEFAULT_OPENAI_STT_MODEL,
  DEFAULT_GEMINI_STT_MODEL,
} from '@/lib/providers'
import { resolveTranscriptionSettings } from '@/lib/api-keys'
import {
  formatTranscriptionSegments,
  segmentsToChunks,
} from '@/lib/transcript-formatter'
import type { TranscriptionInput } from '@/lib/providers/types'

function audio(overrides: Partial<TranscriptionInput> = {}): TranscriptionInput {
  return {
    bytes: new Uint8Array([1, 2, 3, 4]),
    mimeType: 'audio/webm;codecs=opus',
    fileName: 'meeting.webm',
    language: 'ko',
    ...overrides,
  }
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

/** 목의 호출 인자를 좁혀서 읽는다. vi.fn의 추론 타입은 fetch 오버로드와 안 맞는다. */
function callArgs(
  mock: { mock: { calls: unknown[][] } },
  index = 0,
): { url: string; init: RequestInit } {
  const [url, init] = mock.mock.calls[index] as [string, RequestInit]
  return { url, init }
}

function errResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({ error: 'nope' }),
  } as unknown as Response
}

describe('mime 지원 판정', () => {
  it('Whisper는 브라우저 녹음(webm)을 받는다', () => {
    expect(isWhisperSupportedMimeType('audio/webm;codecs=opus')).toBe(true)
    expect(isWhisperSupportedMimeType('audio/mpeg')).toBe(true)
    expect(isWhisperSupportedMimeType('audio/x-aiff')).toBe(false)
  })

  it('Gemini는 webm을 받지 않는다', () => {
    // 이게 true로 바뀌면 UI의 안내 문구도 같이 고쳐야 한다.
    expect(isGeminiSupportedAudioMimeType('audio/webm')).toBe(false)
    expect(isGeminiSupportedAudioMimeType('audio/mpeg')).toBe(true)
    expect(isGeminiSupportedAudioMimeType('audio/flac')).toBe(true)
  })
})

describe('transcribe — OpenAI 호환', () => {
  const settings = {
    provider: 'openai-compatible' as const,
    apiKey: 'sk-test',
    baseUrl: 'https://api.example.com/v1',
  }

  it('multipart로 보내고 verbose_json 구간을 파싱한다', async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({
        text: '안녕하세요 회의 시작합니다',
        segments: [
          { start: 0, end: 2.5, text: ' 안녕하세요' },
          { start: 2.5, end: 5, text: ' 회의 시작합니다' },
        ],
      }),
    )

    const result = await transcribe(audio(), settings, { fetchFn })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.text).toBe('안녕하세요 회의 시작합니다')
    expect(result.segments).toEqual([
      { start: 0, end: 2.5, text: '안녕하세요' },
      { start: 2.5, end: 5, text: '회의 시작합니다' },
    ])
    expect(result.model).toBe(DEFAULT_OPENAI_STT_MODEL)

    const { url, init } = callArgs(fetchFn)
    expect(url).toBe('https://api.example.com/v1/audio/transcriptions')
    expect(init.body).toBeInstanceOf(FormData)

    const form = init.body as FormData
    expect(form.get('model')).toBe(DEFAULT_OPENAI_STT_MODEL)
    expect(form.get('response_format')).toBe('verbose_json')
    expect(form.get('language')).toBe('ko')
  })

  it('어휘 힌트를 prompt로 보낸다', async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({ text: '내용' }),
    )

    await transcribe(audio({ vocabularyHint: '김효천, PACS' }), settings, {
      fetchFn,
    })

    const form = callArgs(fetchFn).init.body as FormData
    expect(form.get('prompt')).toBe('김효천, PACS')
  })

  it('verbose_json 미지원(400)이면 json으로 한 번 더 시도한다', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(errResponse(400))
      .mockResolvedValueOnce(okResponse({ text: '타임스탬프 없는 결과' }))

    const result = await transcribe(audio(), settings, { fetchFn })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.segments).toEqual([])

    const second = callArgs(fetchFn, 1).init.body as FormData
    expect(second.get('response_format')).toBe('json')
  })

  it('429는 rateLimited로 표시한다', async () => {
    const fetchFn = vi.fn(async () => errResponse(429))
    const result = await transcribe(audio(), settings, { fetchFn })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.rateLimited).toBe(true)
  })

  it('빈 전사 결과를 성공으로 넘기지 않는다', async () => {
    const fetchFn = vi.fn(async () => okResponse({ text: '   ' }))
    const result = await transcribe(audio(), settings, { fetchFn })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('비어 있습니다')
  })

  it('base URL이 잘못되면 호출조차 하지 않는다', async () => {
    const fetchFn = vi.fn()
    const result = await transcribe(
      audio(),
      { ...settings, baseUrl: 'file:///etc/passwd' },
      { fetchFn },
    )

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
  })

  it('망가진 구간은 버리고 정상 구간만 남긴다', async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({
        text: 'ok',
        segments: [
          { start: 0, end: 1, text: '정상' },
          { start: 'x', end: 2, text: '시작이 숫자가 아님' },
          { start: 3, end: 4, text: '   ' },
          { start: 5, end: 6, text: '또 정상' },
        ],
      }),
    )

    const result = await transcribe(audio(), settings, { fetchFn })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.segments.map((s) => s.text)).toEqual(['정상', '또 정상'])
  })
})

describe('transcribe — Gemini', () => {
  const settings = { provider: 'gemini' as const, apiKey: 'AIza-test' }

  it('webm은 거부하고 대안을 안내한다', async () => {
    const fetchFn = vi.fn()
    const result = await transcribe(audio(), settings, { fetchFn })

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('OpenAI 호환')
  })

  it('지원 형식은 inline_data로 보낸다', async () => {
    const fetchFn = vi.fn(async () =>
      okResponse({
        candidates: [{ content: { parts: [{ text: '[00:03] 안녕하세요' }] } }],
      }),
    )

    const result = await transcribe(
      audio({ mimeType: 'audio/mpeg', fileName: 'a.mp3' }),
      settings,
      { fetchFn },
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.segments).toEqual([{ start: 3, end: 4, text: '안녕하세요' }])

    const body = JSON.parse(callArgs(fetchFn).init.body as string)
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe('audio/mpeg')
    expect(body.contents[0].parts[1].inline_data.data).toBe(
      Buffer.from([1, 2, 3, 4]).toString('base64'),
    )
  })

  it('inline 상한을 넘으면 호출하지 않고 대안을 안내한다', async () => {
    const fetchFn = vi.fn()
    const result = await transcribe(
      audio({
        mimeType: 'audio/mpeg',
        bytes: new Uint8Array(GEMINI_INLINE_AUDIO_LIMIT + 1),
      }),
      settings,
      { fetchFn },
    )

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('너무 큽니다')
  })

  it('키가 없으면 거부한다', async () => {
    const fetchFn = vi.fn()
    const result = await transcribe(
      audio({ mimeType: 'audio/mpeg' }),
      { provider: 'gemini', apiKey: '  ' },
      { fetchFn },
    )
    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
  })
})

describe('parseTimestampedTranscript', () => {
  it('MM:SS와 HH:MM:SS를 모두 읽는다', () => {
    const segments = parseTimestampedTranscript(
      ['[00:03] 첫 발화', '[01:10] 두 번째', '[1:02:05] 한참 뒤'].join('\n'),
    )

    expect(segments.map((s) => s.start)).toEqual([3, 70, 3725])
  })

  it('다음 구간 시작을 이전 구간의 끝으로 잡는다', () => {
    const segments = parseTimestampedTranscript('[00:00] 가\n[00:10] 나')
    expect(segments[0]).toEqual({ start: 0, end: 10, text: '가' })
    expect(segments[1].end).toBeGreaterThan(segments[1].start)
  })

  it('타임스탬프 없는 줄은 무시한다', () => {
    expect(parseTimestampedTranscript('그냥 텍스트\n또 텍스트')).toEqual([])
  })
})

describe('formatTranscriptionSegments', () => {
  it('실제 오디오 타임라인으로 전사문을 만든다', () => {
    const text = formatTranscriptionSegments([
      { start: 3, text: '어떤 거죠' },
      { start: 3725, text: '한참 뒤' },
    ])

    expect(text).toBe('[00:03] 어떤 거죠\n[01:02:05] 한참 뒤')
  })

  it('빈 구간은 넣지 않는다', () => {
    // Web Speech 경로에서 빈 청크 19개가 요약 프롬프트를 오염시켰다.
    expect(
      formatTranscriptionSegments([
        { start: 0, text: '  ' },
        { start: 1, text: '내용' },
      ]),
    ).toBe('[00:01] 내용')
  })
})

describe('segmentsToChunks', () => {
  it('청크 구조로 옮기면서 시간을 보존한다', () => {
    expect(
      segmentsToChunks([{ start: 1.5, end: 4.25, text: ' 발화 ' }]),
    ).toEqual([{ text: '발화', startTime: 1.5, endTime: 4.25, isFinal: true }])
  })
})

describe('resolveTranscriptionSettings', () => {
  it('대화 모델이 없어도 전사는 가능하다', () => {
    // 요약용 resolveProviderSettings는 model이 비면 null을 준다.
    const settings = resolveTranscriptionSettings({
      provider: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-x',
    })

    expect(settings).not.toBeNull()
    expect(resolveSttModel(settings!)).toBe(DEFAULT_OPENAI_STT_MODEL)
  })

  it('sttModel을 지정하면 그것을 쓴다', () => {
    const settings = resolveTranscriptionSettings({
      provider: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      sttModel: 'gpt-4o-transcribe',
    })
    expect(resolveSttModel(settings!)).toBe('gpt-4o-transcribe')
  })

  it('gemini 기본 STT 모델은 오디오를 받는 모델이다', () => {
    const settings = resolveTranscriptionSettings({
      provider: 'gemini',
      apiKey: 'AIza-x',
    })
    expect(resolveSttModel(settings!)).toBe(DEFAULT_GEMINI_STT_MODEL)
  })

  it('base URL이 없으면 null', () => {
    expect(
      resolveTranscriptionSettings({ provider: 'openai-compatible' }),
    ).toBeNull()
  })
})
