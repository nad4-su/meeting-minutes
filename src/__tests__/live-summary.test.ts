import { describe, it, expect, vi } from 'vitest'
import {
  generateLiveSummary,
  planLiveSummaryRequest,
} from '@/lib/live-summary'

describe('generateLiveSummary', () => {
  it('Gemini API 응답을 받아 중간 요약 마크다운을 반환한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '## 요약\n진행 중인 회의 내용 요약\n\n## 액션 아이템\n- [ ] QA 진행',
                  },
                ],
              },
            },
          ],
        }),
    })

    const result = await generateLiveSummary('안녕하세요 회의 시작합니다', {
      apiKey: 'test-key',
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.markdown).toContain('요약')
      expect(result.markdown).toContain('액션 아이템')
    }
  })

  it('API 키가 비어있으면 에러를 반환한다', async () => {
    const result = await generateLiveSummary('텍스트', {
      apiKey: '',
      fetchFn: vi.fn(),
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('API 키')
    }
  })

  it('transcript가 비어있으면 에러를 반환한다', async () => {
    const result = await generateLiveSummary('   ', {
      apiKey: 'test-key',
      fetchFn: vi.fn(),
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('비어')
    }
  })

  it('429 응답은 rateLimited 플래그와 안내 메시지를 반환한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    })

    const result = await generateLiveSummary('회의 내용', {
      apiKey: 'test-key',
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.rateLimited).toBe(true)
      expect(result.error).toContain('한도 초과')
    }
  })

  it('429 이외의 실패는 상태 코드를 포함한 에러를 반환한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const result = await generateLiveSummary('회의 내용', {
      apiKey: 'test-key',
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('500')
      expect(result.rateLimited).toBeUndefined()
    }
  })

  it('API가 빈 응답을 반환하면 에러로 처리한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [] }),
    })

    const result = await generateLiveSummary('회의 내용', {
      apiKey: 'test-key',
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(false)
  })

  it('x-goog-api-key 헤더로 인증한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: '요약' }] } }],
        }),
    })

    await generateLiveSummary('회의 내용', {
      apiKey: 'secret-key',
      fetchFn: mockFetch,
    })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).not.toContain('secret-key')
    expect(init.headers['x-goog-api-key']).toBe('secret-key')
  })
})

describe('generateLiveSummary — openai-compatible', () => {
  it('OpenAI 호환 엔드포인트로 중간 요약을 만든다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '## 요약\n진행 중' } }],
        }),
    })

    const result = await generateLiveSummary('회의 내용', {
      provider: {
        provider: 'openai-compatible',
        apiKey: 'sk-test',
        baseUrl: 'http://localhost:11434/v1',
        model: 'llama3.1',
      },
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(true)
    expect(mockFetch.mock.calls[0][0]).toBe(
      'http://localhost:11434/v1/chat/completions',
    )
  })
})

describe('planLiveSummaryRequest', () => {
  const base = {
    totalChunks: 50,
    lastSummarizedIndex: 30,
    incrementsSinceFull: 3,
    fullRefreshEvery: 20,
    hasPreviousSummary: true,
  }

  it('평상시에는 직전 지점부터 증분으로 보낸다', () => {
    expect(planLiveSummaryRequest(base)).toEqual({
      mode: 'incremental',
      startIndex: 30,
    })
  })

  it('첫 호출은 전체를 보낸다', () => {
    expect(
      planLiveSummaryRequest({ ...base, lastSummarizedIndex: 0 }),
    ).toEqual({ mode: 'full', startIndex: 0 })
  })

  it('갱신할 직전 요약이 없으면 전체를 보낸다', () => {
    expect(
      planLiveSummaryRequest({ ...base, hasPreviousSummary: false }),
    ).toEqual({ mode: 'full', startIndex: 0 })
  })

  it('증분이 누적되면 전체 재요약으로 오차를 끊는다', () => {
    expect(
      planLiveSummaryRequest({ ...base, incrementsSinceFull: 20 }),
    ).toEqual({ mode: 'full', startIndex: 0 })
  })

  it('fullRefreshEvery=0이면 전체 재요약을 하지 않는다', () => {
    expect(
      planLiveSummaryRequest({
        ...base,
        fullRefreshEvery: 0,
        incrementsSinceFull: 999,
      }).mode,
    ).toBe('incremental')
  })

  it('전사가 초기화되어 인덱스가 범위를 벗어나면 전체를 보낸다', () => {
    expect(
      planLiveSummaryRequest({ ...base, totalChunks: 5 }),
    ).toEqual({ mode: 'full', startIndex: 0 })
  })
})

describe('generateLiveSummary — 증분 모드', () => {
  function mockOk(text = '## 요약\n갱신됨') {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text }] } }],
        }),
    })
  }

  function sentPrompt(mockFetch: ReturnType<typeof vi.fn>): string {
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    return body.contents[0].parts[0].text
  }

  it('previousSummary가 있으면 요약과 신규 발화를 나눠 전달한다', async () => {
    const mockFetch = mockOk()

    await generateLiveSummary('새로 나온 이야기', {
      apiKey: 'k',
      previousSummary: '## 요약\n이전까지의 내용',
      fetchFn: mockFetch,
    })

    const prompt = sentPrompt(mockFetch)
    expect(prompt).toContain('[지금까지의 요약]')
    expect(prompt).toContain('이전까지의 내용')
    expect(prompt).toContain('[새로 추가된 발화]')
    expect(prompt).toContain('새로 나온 이야기')
    expect(prompt).toContain('갱신')
  })

  it('previousSummary가 없으면 기존 전체 요약 형식을 유지한다', async () => {
    const mockFetch = mockOk()

    await generateLiveSummary('전체 전사', { apiKey: 'k', fetchFn: mockFetch })

    const prompt = sentPrompt(mockFetch)
    expect(prompt).toContain('음성 인식 텍스트:')
    expect(prompt).not.toContain('[지금까지의 요약]')
  })

  it('빈 문자열 previousSummary는 증분으로 취급하지 않는다', async () => {
    const mockFetch = mockOk()

    await generateLiveSummary('전체 전사', {
      apiKey: 'k',
      previousSummary: '   ',
      fetchFn: mockFetch,
    })

    expect(sentPrompt(mockFetch)).not.toContain('[지금까지의 요약]')
  })

  it('긴 회의에서 증분 프롬프트가 전체 프롬프트보다 짧다', async () => {
    const longTranscript = '회의 발화 한 줄입니다.\n'.repeat(500)

    const fullFetch = mockOk()
    await generateLiveSummary(longTranscript, {
      apiKey: 'k',
      fetchFn: fullFetch,
    })

    const incFetch = mockOk()
    await generateLiveSummary('마지막 30초에 나온 이야기', {
      apiKey: 'k',
      previousSummary: '## 요약\n지금까지의 요약 본문',
      fetchFn: incFetch,
    })

    expect(sentPrompt(incFetch).length).toBeLessThan(
      sentPrompt(fullFetch).length / 5,
    )
  })
})
