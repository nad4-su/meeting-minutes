import { describe, it, expect, beforeEach } from 'vitest'
import {
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
  maskApiKey,
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
