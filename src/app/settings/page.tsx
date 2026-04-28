'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  clearStoredApiKey,
  getStoredApiKey,
  maskApiKey,
  setStoredApiKey,
} from '@/lib/api-key-storage'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string; reply?: string }
  | { status: 'failed'; message: string }

export default function SettingsPage() {
  const [storedKey, setStoredKey] = useState<string | null>(null)
  const [draftKey, setDraftKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [envConfigured, setEnvConfigured] = useState<boolean | null>(null)
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })
  const [savedToast, setSavedToast] = useState(false)

  useEffect(() => {
    setStoredKey(getStoredApiKey())
    fetch('/api/settings/status')
      .then((r) => r.json())
      .then((d) => setEnvConfigured(!!d.envConfigured))
      .catch(() => setEnvConfigured(false))
  }, [])

  function handleSave() {
    const trimmed = draftKey.trim()
    if (!trimmed) return
    setStoredApiKey(trimmed)
    setStoredKey(trimmed)
    setDraftKey('')
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }

  function handleClear() {
    if (!confirm('브라우저에 저장된 키를 삭제할까요? 환경변수가 설정되어 있다면 그것을 사용합니다.')) {
      return
    }
    clearStoredApiKey()
    setStoredKey(null)
    setTestState({ status: 'idle' })
  }

  async function handleTest() {
    const keyToTest = draftKey.trim() || storedKey
    if (!keyToTest) {
      setTestState({ status: 'failed', message: '테스트할 키가 없습니다.' })
      return
    }

    setTestState({ status: 'testing' })
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestState({
          status: 'success',
          message: data.message,
          reply: data.reply,
        })
      } else {
        setTestState({ status: 'failed', message: data.error ?? '실패' })
      }
    } catch (err) {
      setTestState({
        status: 'failed',
        message: err instanceof Error ? err.message : '네트워크 오류',
      })
    }
  }

  const activeSource = storedKey
    ? '브라우저 (LocalStorage)'
    : envConfigured
      ? '환경변수 (서버)'
      : '없음'

  const activeBadgeStyle = storedKey
    ? 'bg-purple-100 text-purple-700'
    : envConfigured
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700'

  return (
    <main className="flex-1 bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            ← 홈으로
          </Link>
          <Link
            href="/meetings"
            className="text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            📚 저장된 회의록
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            ⚙️ 설정
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Gemini API 키를 브라우저에 저장합니다. 키는 서버에 저장되지 않으며,
            요청 시점에만 전송되어 사용됩니다.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-800">
              현재 키 소스
            </h2>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${activeBadgeStyle}`}
            >
              {activeSource}
            </span>
          </div>

          <div className="space-y-1 text-sm text-neutral-600">
            <p>
              <span className="inline-block w-32 text-neutral-500">브라우저 키:</span>{' '}
              {storedKey ? (
                <span className="font-mono">{maskApiKey(storedKey)}</span>
              ) : (
                <span className="text-neutral-400">미설정</span>
              )}
            </p>
            <p>
              <span className="inline-block w-32 text-neutral-500">환경변수 키:</span>{' '}
              {envConfigured === null ? (
                <span className="text-neutral-400">확인 중...</span>
              ) : envConfigured ? (
                <span className="text-green-700">설정됨</span>
              ) : (
                <span className="text-neutral-400">미설정</span>
              )}
            </p>
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            💡 우선순위: 브라우저 키 → 환경변수 → 단순 변환 폴백
          </p>
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-neutral-800">
            Gemini API 키
          </h2>

          <label className="block mb-2 text-sm text-neutral-600">
            새 키 입력
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="AIzaSy..."
              className="flex-1 rounded-xl border border-neutral-300 px-4 py-3 font-mono text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="rounded-xl border border-neutral-300 px-3 text-sm hover:bg-neutral-50 transition-colors"
              title={showKey ? '숨기기' : '보이기'}
            >
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>

          <p className="mt-2 text-xs text-neutral-500">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-purple-600"
            >
              Google AI Studio
            </a>
            에서 무료로 발급할 수 있습니다.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              disabled={!draftKey.trim()}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              💾 저장
            </button>
            <button
              onClick={handleTest}
              disabled={
                testState.status === 'testing' ||
                (!draftKey.trim() && !storedKey)
              }
              className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              {testState.status === 'testing' ? '테스트 중...' : '🧪 테스트 호출'}
            </button>
            {storedKey && (
              <button
                onClick={handleClear}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                🗑️ 삭제
              </button>
            )}
          </div>

          {savedToast && (
            <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-700">
              ✓ 브라우저에 저장되었습니다.
            </div>
          )}

          {testState.status === 'success' && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <strong>✓ {testState.message}</strong>
              {testState.reply && (
                <p className="mt-1 font-mono text-xs text-green-600">
                  Gemini 응답: {testState.reply}
                </p>
              )}
            </div>
          )}

          {testState.status === 'failed' && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              ✗ {testState.message}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            보안 안내
          </h3>
          <ul className="space-y-1 text-xs text-neutral-600 list-disc list-inside">
            <li>키는 이 브라우저의 LocalStorage에만 저장됩니다 (서버 DB에 저장되지 않음).</li>
            <li>요약 요청 시 body로 함께 전송되어 일회성으로 사용됩니다.</li>
            <li>다른 브라우저/기기에서는 다시 입력해야 합니다.</li>
            <li>시크릿 모드 종료, 캐시 삭제 시 사라집니다.</li>
            <li>HTTPS 환경에서 사용하는 것을 권장합니다 (현재 localhost는 예외).</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
