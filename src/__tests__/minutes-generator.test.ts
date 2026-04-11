import { describe, it, expect, vi } from 'vitest'
import {
  generateSimpleMinutes,
  generateGeminiMinutes,
  type MinutesInput,
} from '@/lib/minutes-generator'

const sampleInput: MinutesInput = {
  title: '주간 스프린트 회의',
  date: new Date('2026-04-11T10:00:00'),
  transcript: `[00:00] 안녕하세요 오늘 주간 회의를 시작하겠습니다
[00:05] 지난 주 작업 내역을 공유해주세요
[00:15] 프론트엔드 리팩토링을 완료했습니다
[00:30] 백엔드 API 성능 개선 작업 중입니다
[01:00] 다음 주 계획을 논의하겠습니다
[01:15] QA 테스트를 진행할 예정입니다`,
}

describe('generateSimpleMinutes', () => {
  it('마크다운 형식의 회의록을 생성한다', () => {
    const result = generateSimpleMinutes(sampleInput)

    expect(result).toContain('# 주간 스프린트 회의')
    expect(result).toContain('2026-04-11')
    expect(result).toContain('## 회의 내용')
    expect(result).toContain('안녕하세요')
  })

  it('타임스탬프를 유지한다', () => {
    const result = generateSimpleMinutes(sampleInput)
    expect(result).toContain('[00:00]')
    expect(result).toContain('[01:15]')
  })

  it('빈 transcript이면 해당 섹션에 안내 문구를 넣는다', () => {
    const input: MinutesInput = {
      ...sampleInput,
      transcript: '',
    }
    const result = generateSimpleMinutes(input)
    expect(result).toContain('내용 없음')
  })
})

describe('generateGeminiMinutes', () => {
  it('Gemini API를 호출하여 요약된 회의록을 반환한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '## 요약\n- 프론트엔드 리팩토링 완료\n- 백엔드 API 성능 개선 진행 중\n\n## 액션 아이템\n- QA 테스트 진행',
                  },
                ],
              },
            },
          ],
        }),
    })

    const result = await generateGeminiMinutes(sampleInput, {
      apiKey: 'test-key',
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.markdown).toContain('# 주간 스프린트 회의')
      expect(result.markdown).toContain('요약')
      expect(result.markdown).toContain('액션 아이템')
    }
  })

  it('API 호출 실패 시 에러를 반환한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    })

    const result = await generateGeminiMinutes(sampleInput, {
      apiKey: 'test-key',
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Gemini API')
    }
  })

  it('API 키가 없으면 에러를 반환한다', async () => {
    const result = await generateGeminiMinutes(sampleInput, {
      apiKey: '',
      fetchFn: vi.fn(),
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('API 키')
    }
  })
})
