import { describe, it, expect, vi } from 'vitest'
import {
  CONDENSE_WINDOW_CHARS,
  MAX_TRANSCRIPT_CHARS,
  SINGLE_PASS_CHAR_LIMIT,
  condenseTranscript,
  planTranscriptWindows,
} from '@/lib/long-transcript'

function okResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  } as unknown as Response
}

const settings = { provider: 'gemini' as const, apiKey: 'AIza-test' }

describe('planTranscriptWindows', () => {
  it('상한 안이면 통째로 하나', () => {
    expect(planTranscriptWindows('짧은 전사문', 100)).toEqual(['짧은 전사문'])
  })

  it('빈 입력은 구간이 없다', () => {
    expect(planTranscriptWindows('   ', 100)).toEqual([])
  })

  it('줄 경계에서 나눈다', () => {
    const lines = ['[00:00] 가나다', '[00:05] 라마바', '[00:10] 사아자']
    const windows = planTranscriptWindows(lines.join('\n'), 25)

    expect(windows.length).toBeGreaterThan(1)
    for (const w of windows) {
      // 줄 중간에서 끊기지 않았다
      for (const line of w.split('\n')) {
        expect(lines).toContain(line)
      }
    }
  })

  it('어떤 내용도 잃지 않는다', () => {
    const lines = Array.from({ length: 500 }, (_, i) => `[00:${i % 60}] 발화 ${i}`)
    const source = lines.join('\n')

    const windows = planTranscriptWindows(source, 200)

    expect(windows.join('\n')).toBe(source)
  })

  it('상한을 넘는 구간은 없다', () => {
    const source = Array.from({ length: 300 }, (_, i) => `줄 ${i}`).join('\n')
    for (const w of planTranscriptWindows(source, 50)) {
      expect(w.length).toBeLessThanOrEqual(50)
    }
  })

  it('한 줄이 통째로 상한보다 길면 그 줄만 강제로 자른다', () => {
    const long = 'ㄱ'.repeat(250)
    const windows = planTranscriptWindows(long, 100)

    expect(windows).toHaveLength(3)
    expect(windows.join('')).toBe(long)
  })

  it('maxChars가 0 이하면 거부한다', () => {
    expect(() => planTranscriptWindows('가', 0)).toThrow()
  })

  it('압축 창은 단일 통과 상한보다 작다', () => {
    // 압축한 결과를 다시 한 번에 넣을 수 있어야 map-reduce가 성립한다.
    expect(CONDENSE_WINDOW_CHARS).toBeLessThan(SINGLE_PASS_CHAR_LIMIT)
    expect(SINGLE_PASS_CHAR_LIMIT).toBeLessThan(MAX_TRANSCRIPT_CHARS)
  })
})

describe('condenseTranscript', () => {
  it('구간마다 한 번씩 호출하고 결과를 이어 붙인다', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(okResponse('앞부분 정리'))
      .mockResolvedValueOnce(okResponse('뒷부분 정리'))

    const source = Array.from({ length: 40 }, (_, i) => `줄 ${i}`).join('\n')
    const result = await condenseTranscript(source, {
      provider: settings,
      windowChars: 120,
      fetchFn,
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(result.windows).toBe(2)
    expect(result.text).toContain('앞부분 정리')
    expect(result.text).toContain('뒷부분 정리')
    expect(result.text).toContain('구간 1/2')
  })

  it('프롬프트에 구간 위치를 알려 앞뒤를 지어내지 않게 한다', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse('정리'))
    const source = Array.from({ length: 40 }, (_, i) => `줄 ${i}`).join('\n')

    await condenseTranscript(source, {
      provider: settings,
      windowChars: 120,
      fetchFn,
    })

    const body = JSON.parse(
      (fetchFn.mock.calls[0][1] as RequestInit).body as string,
    )
    const prompt = body.contents[0].parts[0].text
    expect(prompt).toContain('1/2 구간')
    expect(prompt).toContain('추측해 채우지 않습니다')
  })

  it('한 구간이라도 실패하면 전체를 실패로 돌린다', async () => {
    // 일부만 빠진 압축본으로 회의록을 만들면 사용자는 무엇이 빠졌는지 모른다.
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(okResponse('앞부분'))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as unknown as Response)

    const source = Array.from({ length: 40 }, (_, i) => `줄 ${i}`).join('\n')
    const result = await condenseTranscript(source, {
      provider: settings,
      windowChars: 120,
      fetchFn,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('2/2 구간')
  })

  it('빈 응답도 실패로 본다', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse('   '))
    const result = await condenseTranscript('짧은 글', {
      provider: settings,
      fetchFn,
    })

    expect(result.success).toBe(false)
  })

  it('429는 rateLimited로 올려보낸다', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as unknown as Response)

    const result = await condenseTranscript('짧은 글', {
      provider: settings,
      fetchFn,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.rateLimited).toBe(true)
  })

  it('빈 전사문은 호출조차 하지 않는다', async () => {
    const fetchFn = vi.fn()
    const result = await condenseTranscript('  ', {
      provider: settings,
      fetchFn,
    })

    expect(fetchFn).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
  })
})
