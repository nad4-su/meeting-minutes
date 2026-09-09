'use client'

import { findPreset, type ProviderId } from './providers'

const STORAGE_KEY = 'meeting-minutes:gemini-api-key'

export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value && value.length > 0 ? value : null
  } catch {
    return null
  }
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // ignore storage errors (private mode, quota)
  }
}

export function clearStoredApiKey(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

/* ------------------------------------------------------------------------- *
 * 프로바이더 설정 (Gemini / OpenAI 호환 엔드포인트)
 * ------------------------------------------------------------------------- */

const PROVIDER_STORAGE_KEY = 'meeting-minutes:llm-provider'

export interface StoredProviderConfig {
  presetId: string
  apiKey: string
  baseUrl: string
  model: string
  /** 음성 전사 모델. 비우면 프리셋 기본값을 쓴다. */
  sttModel?: string
}

export interface ProviderRequestPayload {
  provider: ProviderId
  apiKey: string
  baseUrl: string
  model: string
  sttModel: string
}

export function getStoredProviderConfig(): StoredProviderConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROVIDER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredProviderConfig>
    if (typeof parsed?.presetId !== 'string') return null
    return {
      presetId: parsed.presetId,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
      sttModel: typeof parsed.sttModel === 'string' ? parsed.sttModel : '',
    }
  } catch {
    return null
  }
}

export function setStoredProviderConfig(config: StoredProviderConfig): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // ignore storage errors (private mode, quota)
  }
}

export function clearStoredProviderConfig(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PROVIDER_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * 요약 요청 body에 실을 프로바이더 정보.
 *
 * 프로바이더 설정이 없으면 기존 Gemini 키만 쓰던 사용자를 그대로 이어받는다
 * (별도 마이그레이션 없이 동작).
 */
export function getProviderRequestPayload(): ProviderRequestPayload {
  const stored = getStoredProviderConfig()

  if (!stored) {
    return {
      provider: 'gemini',
      apiKey: getStoredApiKey() ?? '',
      baseUrl: '',
      model: '',
      sttModel: '',
    }
  }

  const preset = findPreset(stored.presetId)
  return {
    provider: preset.provider,
    apiKey: stored.apiKey || (preset.provider === 'gemini' ? getStoredApiKey() ?? '' : ''),
    baseUrl: stored.baseUrl,
    model: stored.model,
    sttModel: stored.sttModel ?? '',
  }
}
