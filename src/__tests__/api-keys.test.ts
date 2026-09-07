import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  resolveGeminiApiKey,
  isEnvKeyConfigured,
  isEnvProviderConfigured,
  resolveProviderSettings,
} from '@/lib/api-keys'

describe('resolveGeminiApiKey', () => {
  const originalEnv = process.env.GEMINI_API_KEY

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GEMINI_API_KEY
    } else {
      process.env.GEMINI_API_KEY = originalEnv
    }
  })

  it('요청 키가 우선이다', () => {
    process.env.GEMINI_API_KEY = 'env-key'
    expect(resolveGeminiApiKey('request-key')).toBe('request-key')
  })

  it('요청 키가 없으면 환경변수 키로 폴백한다', () => {
    process.env.GEMINI_API_KEY = 'env-key'
    expect(resolveGeminiApiKey()).toBe('env-key')
    expect(resolveGeminiApiKey(null)).toBe('env-key')
    expect(resolveGeminiApiKey(undefined)).toBe('env-key')
    expect(resolveGeminiApiKey('')).toBe('env-key')
    expect(resolveGeminiApiKey('   ')).toBe('env-key')
  })

  it('둘 다 비어있으면 null', () => {
    expect(resolveGeminiApiKey()).toBeNull()
    expect(resolveGeminiApiKey('')).toBeNull()
  })

  it('요청 키 앞뒤 공백을 제거한다', () => {
    expect(resolveGeminiApiKey('  abc  ')).toBe('abc')
  })

  it('환경변수 키 앞뒤 공백을 제거한다', () => {
    process.env.GEMINI_API_KEY = '  env-key  '
    expect(resolveGeminiApiKey()).toBe('env-key')
  })
})

describe('isEnvKeyConfigured', () => {
  const originalEnv = process.env.GEMINI_API_KEY

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GEMINI_API_KEY
    } else {
      process.env.GEMINI_API_KEY = originalEnv
    }
  })

  it('환경변수가 설정되어 있으면 true', () => {
    process.env.GEMINI_API_KEY = 'AIza...'
    expect(isEnvKeyConfigured()).toBe(true)
  })

  it('비어있거나 공백만 있으면 false', () => {
    delete process.env.GEMINI_API_KEY
    expect(isEnvKeyConfigured()).toBe(false)
    process.env.GEMINI_API_KEY = ''
    expect(isEnvKeyConfigured()).toBe(false)
    process.env.GEMINI_API_KEY = '   '
    expect(isEnvKeyConfigured()).toBe(false)
  })
})

describe('resolveProviderSettings', () => {
  const ENV_KEYS = [
    'GEMINI_API_KEY',
    'LLM_PROVIDER',
    'LLM_BASE_URL',
    'LLM_API_KEY',
    'LLM_MODEL',
  ] as const
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it('provider를 지정하지 않으면 gemini로 간주한다', () => {
    expect(resolveProviderSettings({ apiKey: 'req-key' })).toEqual({
      provider: 'gemini',
      apiKey: 'req-key',
      model: undefined,
    })
  })

  it('gemini인데 키가 아무데도 없으면 null (단순 변환 폴백)', () => {
    expect(resolveProviderSettings({})).toBeNull()
    expect(resolveProviderSettings(null)).toBeNull()
  })

  it('gemini 키는 요청 → GEMINI_API_KEY 순으로 해석한다', () => {
    process.env.GEMINI_API_KEY = 'env-key'
    expect(resolveProviderSettings({ apiKey: 'req-key' })?.apiKey).toBe('req-key')
    expect(resolveProviderSettings({})?.apiKey).toBe('env-key')
  })

  it('openai-compatible은 baseUrl과 model이 모두 있어야 한다', () => {
    const base = { provider: 'openai-compatible', apiKey: 'sk-x' }
    expect(resolveProviderSettings(base)).toBeNull()
    expect(
      resolveProviderSettings({ ...base, baseUrl: 'https://a.example/v1' }),
    ).toBeNull()
    expect(
      resolveProviderSettings({ ...base, model: 'gpt-4o-mini' }),
    ).toBeNull()
    expect(
      resolveProviderSettings({
        ...base,
        baseUrl: 'https://a.example/v1',
        model: 'gpt-4o-mini',
      }),
    ).toEqual({
      provider: 'openai-compatible',
      apiKey: 'sk-x',
      baseUrl: 'https://a.example/v1',
      model: 'gpt-4o-mini',
    })
  })

  it('openai-compatible은 키가 비어도 허용한다 (로컬 모델 서버)', () => {
    const settings = resolveProviderSettings({
      provider: 'openai-compatible',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1',
    })
    expect(settings?.apiKey).toBe('')
  })

  it('LLM_* 환경변수만으로도 설정된다', () => {
    process.env.LLM_PROVIDER = 'openai-compatible'
    process.env.LLM_BASE_URL = 'https://api.orcarouter.ai/v1'
    process.env.LLM_MODEL = 'google/gemini-2.5-flash-lite'
    process.env.LLM_API_KEY = 'sk-env'

    expect(resolveProviderSettings({})).toEqual({
      provider: 'openai-compatible',
      apiKey: 'sk-env',
      baseUrl: 'https://api.orcarouter.ai/v1',
      model: 'google/gemini-2.5-flash-lite',
    })
  })

  it('알 수 없는 provider 값은 무시하고 기본값으로 떨어진다', () => {
    process.env.GEMINI_API_KEY = 'env-key'
    expect(resolveProviderSettings({ provider: 'anthropic' })?.provider).toBe(
      'gemini',
    )
  })
})

describe('isEnvProviderConfigured', () => {
  const ENV_KEYS = ['GEMINI_API_KEY', 'LLM_PROVIDER', 'LLM_BASE_URL', 'LLM_MODEL', 'LLM_API_KEY'] as const
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it('아무 것도 없으면 false', () => {
    expect(isEnvProviderConfigured()).toBe(false)
  })

  it('GEMINI_API_KEY만 있어도 true', () => {
    process.env.GEMINI_API_KEY = 'k'
    expect(isEnvProviderConfigured()).toBe(true)
  })

  it('openai-compatible은 base URL과 모델까지 있어야 true', () => {
    process.env.LLM_PROVIDER = 'openai-compatible'
    process.env.LLM_API_KEY = 'k'
    expect(isEnvProviderConfigured()).toBe(false)

    process.env.LLM_BASE_URL = 'https://a.example/v1'
    process.env.LLM_MODEL = 'm'
    expect(isEnvProviderConfigured()).toBe(true)
  })
})
