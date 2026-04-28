import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveGeminiApiKey, isEnvKeyConfigured } from '@/lib/api-keys'

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
