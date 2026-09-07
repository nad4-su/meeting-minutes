import { describe, it, expect, vi } from 'vitest'
import {
  complete,
  describeModel,
  normalizeBaseUrl,
  toProviderSettings,
  DEFAULT_GEMINI_MODEL,
  findPreset,
  PROVIDER_PRESETS,
} from '@/lib/providers'

function okResponse(content: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  }
}

const OPENAI_SETTINGS = {
  provider: 'openai-compatible' as const,
  apiKey: 'sk-test',
  baseUrl: 'https://api.orcarouter.ai/v1',
  model: 'google/gemini-2.5-flash-lite',
}

describe('normalizeBaseUrl', () => {
  it('끝의 슬래시를 제거한다', () => {
    expect(normalizeBaseUrl('https://api.example.com/v1/')).toBe(
      'https://api.example.com/v1',
    )
  })

  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeBaseUrl('  https://api.example.com/v1  ')).toBe(
      'https://api.example.com/v1',
    )
  })

  it('http/https 이외의 스킴은 거부한다', () => {
    expect(normalizeBaseUrl('file:///etc/passwd')).toBeNull()
    expect(normalizeBaseUrl('ftp://example.com')).toBeNull()
  })

  it('URL이 아니거나 비어 있으면 null', () => {
    expect(normalizeBaseUrl('not-a-url')).toBeNull()
    expect(normalizeBaseUrl('   ')).toBeNull()
  })
})

describe('complete — openai-compatible', () => {
  it('/chat/completions로 OpenAI 형식 요청을 보낸다', async () => {
    const mockFetch = vi.fn().mockResolvedValue(okResponse('## 요약'))

    const result = await complete('프롬프트', OPENAI_SETTINGS, {
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.text).toBe('## 요약')

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.orcarouter.ai/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer sk-test')

    const body = JSON.parse(init.body)
    expect(body.model).toBe('google/gemini-2.5-flash-lite')
    expect(body.messages).toEqual([{ role: 'user', content: '프롬프트' }])
  })

  it('키가 없으면 Authorization 헤더를 붙이지 않는다 (로컬 모델 서버)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(okResponse('요약'))

    await complete(
      '프롬프트',
      { ...OPENAI_SETTINGS, apiKey: '', baseUrl: 'http://localhost:11434/v1' },
      { fetchFn: mockFetch },
    )

    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('base URL이 없으면 호출하지 않고 에러를 반환한다', async () => {
    const mockFetch = vi.fn()

    const result = await complete(
      '프롬프트',
      { ...OPENAI_SETTINGS, baseUrl: '' },
      { fetchFn: mockFetch },
    )

    expect(result.success).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('모델이 없으면 호출하지 않고 에러를 반환한다', async () => {
    const mockFetch = vi.fn()

    const result = await complete(
      '프롬프트',
      { ...OPENAI_SETTINGS, model: '  ' },
      { fetchFn: mockFetch },
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('모델')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('429는 rateLimited 플래그를 세운다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 })

    const result = await complete('프롬프트', OPENAI_SETTINGS, {
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.rateLimited).toBe(true)
  })

  it('401은 인증 실패로 안내한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })

    const result = await complete('프롬프트', OPENAI_SETTINGS, {
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('인증')
  })

  it('네트워크 예외를 결과 객체로 감싼다', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await complete('프롬프트', OPENAI_SETTINGS, {
      fetchFn: mockFetch,
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('ECONNREFUSED')
  })
})

describe('complete — gemini 라우팅', () => {
  it('provider가 gemini면 Google 엔드포인트를 호출한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: '요약' }] } }],
        }),
    })

    await complete(
      '프롬프트',
      { provider: 'gemini', apiKey: 'AIza-test' },
      { fetchFn: mockFetch },
    )

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('generativelanguage.googleapis.com')
    expect(url).toContain(DEFAULT_GEMINI_MODEL)
    expect(init.headers['x-goog-api-key']).toBe('AIza-test')
  })

  it('모델을 지정하면 해당 모델 엔드포인트를 호출한다', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: '요약' }] } }],
        }),
    })

    await complete(
      '프롬프트',
      { provider: 'gemini', apiKey: 'AIza-test', model: 'gemini-2.5-pro' },
      { fetchFn: mockFetch },
    )

    expect(mockFetch.mock.calls[0][0]).toContain('gemini-2.5-pro')
  })
})

describe('toProviderSettings', () => {
  it('provider가 없으면 기존 Gemini 호출부와 동일하게 동작한다', () => {
    expect(toProviderSettings(undefined, 'legacy-key')).toEqual({
      provider: 'gemini',
      apiKey: 'legacy-key',
    })
  })

  it('provider가 있으면 그대로 사용한다', () => {
    expect(toProviderSettings(OPENAI_SETTINGS, 'ignored')).toBe(OPENAI_SETTINGS)
  })
})

describe('describeModel', () => {
  it('gemini는 기본 모델명을 돌려준다', () => {
    expect(describeModel({ provider: 'gemini', apiKey: 'k' })).toBe(
      DEFAULT_GEMINI_MODEL,
    )
  })

  it('openai-compatible은 설정한 모델명을 돌려준다', () => {
    expect(describeModel(OPENAI_SETTINGS)).toBe('google/gemini-2.5-flash-lite')
  })
})

describe('프리셋', () => {
  it('알 수 없는 id는 기본 프리셋으로 폴백한다', () => {
    expect(findPreset('없는-프리셋').id).toBe('gemini')
    expect(findPreset(null).id).toBe('gemini')
  })

  it('openai-compatible 프리셋은 base URL 또는 직접 입력 안내를 갖는다', () => {
    for (const preset of PROVIDER_PRESETS) {
      if (preset.provider !== 'openai-compatible') continue
      expect(preset.id === 'custom' || preset.baseUrl.length > 0).toBe(true)
    }
  })
})
