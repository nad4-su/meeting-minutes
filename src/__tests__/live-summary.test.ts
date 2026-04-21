import { describe, it, expect, vi } from 'vitest'
import { generateLiveSummary } from '@/lib/live-summary'

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
