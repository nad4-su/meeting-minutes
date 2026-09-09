import { describe, it, expect, beforeEach } from 'vitest'
import {
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
  maskApiKey,
  getStoredProviderConfig,
  setStoredProviderConfig,
  clearStoredProviderConfig,
  getProviderRequestPayload,
} from '@/lib/api-key-storage'

describe('LocalStorage api key helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('저장 후 동일 키를 반환한다', () => {
    setStoredApiKey('AIza-test-key')
    expect(getStoredApiKey()).toBe('AIza-test-key')
  })

  it('미설정 시 null 반환', () => {
    expect(getStoredApiKey()).toBeNull()
  })

  it('빈 문자열 저장 시 null로 취급', () => {
    setStoredApiKey('')
    expect(getStoredApiKey()).toBeNull()
  })

  it('clear 시 삭제된다', () => {
    setStoredApiKey('AIza-test-key')
    clearStoredApiKey()
    expect(getStoredApiKey()).toBeNull()
  })
})

describe('maskApiKey', () => {
  it('긴 키는 앞 4자 + ••• + 뒤 4자', () => {
    expect(maskApiKey('AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234')).toBe(
      'AIza••••1234',
    )
  })

  it('8자 이하는 전부 마스킹', () => {
    expect(maskApiKey('short')).toBe('••••')
    expect(maskApiKey('12345678')).toBe('••••')
  })

  it('정확히 9자는 마스킹 적용', () => {
    expect(maskApiKey('123456789')).toBe('1234••••6789')
  })
})

describe('프로바이더 설정 저장', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('저장 후 동일한 설정을 돌려준다', () => {
    setStoredProviderConfig({
      presetId: 'orcarouter',
      apiKey: 'sk-test',
      baseUrl: 'https://api.orcarouter.ai/v1',
      model: 'google/gemini-2.5-flash-lite',
    })

    expect(getStoredProviderConfig()).toEqual({
      presetId: 'orcarouter',
      apiKey: 'sk-test',
      baseUrl: 'https://api.orcarouter.ai/v1',
      model: 'google/gemini-2.5-flash-lite',
      // 예전에 저장된 설정에는 sttModel이 없다. 빈 값으로 채워 마이그레이션 없이 읽힌다.
      sttModel: '',
    })
  })

  it('미설정이거나 깨진 값이면 null', () => {
    expect(getStoredProviderConfig()).toBeNull()
    window.localStorage.setItem('meeting-minutes:llm-provider', '{not json')
    expect(getStoredProviderConfig()).toBeNull()
  })

  it('clear 시 삭제된다', () => {
    setStoredProviderConfig({
      presetId: 'openai',
      apiKey: 'sk',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    })
    clearStoredProviderConfig()
    expect(getStoredProviderConfig()).toBeNull()
  })
})

describe('getProviderRequestPayload', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('프로바이더 설정이 없으면 기존 Gemini 키를 그대로 사용한다', () => {
    setStoredApiKey('AIza-legacy')

    expect(getProviderRequestPayload()).toEqual({
      provider: 'gemini',
      apiKey: 'AIza-legacy',
      baseUrl: '',
      model: '',
      sttModel: '',
    })
  })

  it('아무것도 없으면 빈 gemini 설정을 돌려준다', () => {
    expect(getProviderRequestPayload()).toEqual({
      provider: 'gemini',
      apiKey: '',
      baseUrl: '',
      model: '',
      sttModel: '',
    })
  })

  it('프리셋 id로부터 provider를 결정한다', () => {
    setStoredProviderConfig({
      presetId: 'local',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1',
    })

    expect(getProviderRequestPayload()).toEqual({
      provider: 'openai-compatible',
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.1',
      sttModel: '',
    })
  })

  it('gemini 프리셋에서 키를 비워두면 기존 키로 폴백한다', () => {
    setStoredApiKey('AIza-legacy')
    setStoredProviderConfig({
      presetId: 'gemini',
      apiKey: '',
      baseUrl: '',
      model: 'gemini-2.5-pro',
    })

    const payload = getProviderRequestPayload()
    expect(payload.provider).toBe('gemini')
    expect(payload.apiKey).toBe('AIza-legacy')
    expect(payload.model).toBe('gemini-2.5-pro')
  })
})
