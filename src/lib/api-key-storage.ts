'use client'

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
