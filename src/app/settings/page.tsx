'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  clearStoredApiKey,
  clearStoredProviderConfig,
  getStoredApiKey,
  getStoredProviderConfig,
  maskApiKey,
  setStoredProviderConfig,
} from '@/lib/api-key-storage'
import {
  DEFAULT_PRESET_ID,
  PROVIDER_PRESETS,
  findPreset,
} from '@/lib/providers'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string; model?: string; reply?: string }
  | { status: 'failed'; message: string }

export default function SettingsPage() {
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [envConfigured, setEnvConfigured] = useState<boolean | null>(null)
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })
  const [savedToast, setSavedToast] = useState(false)

  const preset = findPreset(presetId)
  const isOpenAiCompatible = preset.provider === 'openai-compatible'

  useEffect(() => {
    const stored = getStoredProviderConfig()
    if (stored) {
      const storedPreset = findPreset(stored.presetId)
      setPresetId(storedPreset.id)
      setApiKey(stored.apiKey)
      setBaseUrl(stored.baseUrl)
      setModel(stored.model)
      setSavedKey(stored.apiKey || null)
    } else {
      // 프로바이더 설정 이전에 저장해둔 Gemini 키를 그대로 이어받는다.
      const legacyKey = getStoredApiKey()
      setApiKey(legacyKey ?? '')
      setModel(findPreset(DEFAULT_PRESET_ID).defaultModel)
      setSavedKey(legacyKey)
    }

    fetch('/api/settings/status')
      .then((r) => r.json())
      .then((d) => setEnvConfigured(!!d.envConfigured || !!d.envProviderConfigured))
      .catch(() => setEnvConfigured(false))
  }, [])

  function handlePresetChange(nextId: string) {
    const next = findPreset(nextId)
    if (next.id === presetId) return

    setPresetId(next.id)
    setBaseUrl(next.baseUrl)
    setModel(next.defaultModel)
    // 프로바이더가 바뀌면 이전 키는 무의미할 뿐 아니라, 그대로 두면
    // 다른 회사 엔드포인트로 전송될 수 있으므로 비운다.
    setApiKey('')
    setTestState({ status: 'idle' })
  }

  function handleSave() {
    setStoredProviderConfig({
      presetId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
    })
    setSavedKey(apiKey.trim() || null)
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
  }

  function handleClear() {
    if (
      !confirm(
        '브라우저에 저장된 프로바이더 설정과 키를 삭제할까요? 환경변수가 설정되어 있다면 그것을 사용합니다.',
      )
    ) {
      return
    }
    clearStoredProviderConfig()
    clearStoredApiKey()
    const fallback = findPreset(DEFAULT_PRESET_ID)
    setPresetId(fallback.id)
    setApiKey('')
    setBaseUrl(fallback.baseUrl)
    setModel(fallback.defaultModel)
    setSavedKey(null)
    setTestState({ status: 'idle' })
  }

  async function handleTest() {
    setTestState({ status: 'testing' })
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: preset.provider,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
          model: model.trim(),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestState({
          status: 'success',
          message: data.message,
          model: data.model,
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

  const canTest =
    testState.status !== 'testing' &&
    (preset.apiKeyOptional || apiKey.trim().length > 0) &&
    (!isOpenAiCompatible || (baseUrl.trim().length > 0 && model.trim().length > 0))

  const activeSource = savedKey
    ? '브라우저 (LocalStorage)'
    : envConfigured
      ? '환경변수 (서버)'
      : '없음'

  const activeBadgeStyle = savedKey
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
            AI 요약에 사용할 프로바이더와 키를 브라우저에 저장합니다. 키는 서버 DB에
            저장되지 않으며, 요청 시점에만 전송되어 사용됩니다.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-800">
              현재 설정
            </h2>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${activeBadgeStyle}`}
            >
              {activeSource}
            </span>
          </div>

          <div className="space-y-1 text-sm text-neutral-600">
            <p>
              <span className="inline-block w-32 text-neutral-500">프로바이더:</span>{' '}
              <span className="font-medium text-neutral-800">{preset.label}</span>
            </p>
            <p>
              <span className="inline-block w-32 text-neutral-500">모델:</span>{' '}
              {model.trim() ? (
                <span className="font-mono text-xs">{model.trim()}</span>
              ) : (
                <span className="text-neutral-400">기본값</span>
              )}
            </p>
            <p>
              <span className="inline-block w-32 text-neutral-500">브라우저 키:</span>{' '}
              {savedKey ? (
                <span className="font-mono">{maskApiKey(savedKey)}</span>
              ) : (
                <span className="text-neutral-400">미설정</span>
              )}
            </p>
            <p>
              <span className="inline-block w-32 text-neutral-500">환경변수:</span>{' '}
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
            💡 우선순위: 브라우저 설정 → 환경변수 → 단순 변환 폴백
          </p>
        </section>

        <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-neutral-800">
            프로바이더
          </h2>

          <div className="flex flex-wrap gap-2">
            {PROVIDER_PRESETS.map((item) => (
              <button
                key={item.id}
                onClick={() => handlePresetChange(item.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  presetId === item.id
                    ? 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="mt-3 text-xs text-neutral-500">{preset.description}</p>

          {isOpenAiCompatible && (
            <div className="mt-5">
              <label className="mb-2 block text-sm text-neutral-600">
                API 주소 (base URL)
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 font-mono text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all"
              />
              <p className="mt-1 text-xs text-neutral-500">
                OpenAI 호환 엔드포인트의 <code>/chat/completions</code> 앞부분까지
                입력하세요.
              </p>
            </div>
          )}

          <div className="mt-5">
            <label className="mb-2 block text-sm text-neutral-600">모델</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={preset.defaultModel || 'model-id'}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 font-mono text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all"
            />
            {preset.modelHint && (
              <p className="mt-1 text-xs text-neutral-500">{preset.modelHint}</p>
            )}
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm text-neutral-600">
              {preset.apiKeyLabel}
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={preset.apiKeyPlaceholder}
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
            {preset.docsUrl && (
              <p className="mt-2 text-xs text-neutral-500">
                <a
                  href={preset.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-purple-600"
                >
                  {preset.docsLabel ?? preset.docsUrl}
                </a>
                에서 발급할 수 있습니다.
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              💾 저장
            </button>
            <button
              onClick={handleTest}
              disabled={!canTest}
              className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              {testState.status === 'testing' ? '테스트 중...' : '🧪 테스트 호출'}
            </button>
            <button
              onClick={handleClear}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              🗑️ 삭제
            </button>
          </div>

          {savedToast && (
            <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm text-purple-700">
              ✓ 브라우저에 저장되었습니다.
            </div>
          )}

          {testState.status === 'success' && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <strong>✓ {testState.message}</strong>
              <p className="mt-1 font-mono text-xs text-green-600">
                {testState.model ? `${testState.model} → ` : ''}
                {testState.reply}
              </p>
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
            <li className="text-amber-700">
              ⚠️ <strong>공유 PC에서는 사용 후 반드시 🗑️ 삭제 버튼을 눌러주세요.</strong> 로그인 상태로 자리를 비우면 다른 사용자가 개발자 도구로 LocalStorage를 직접 열어 키를 추출할 수 있습니다.
            </li>
            <li className="text-amber-700">
              ⚠️ <strong>회의 내용에 민감 정보가 포함된 경우</strong>, 실시간 녹음 기능은 음성을 Google 서버로 전송합니다 (Chrome Web Speech API 동작). 사내 컴플라이언스 정책 확인 후 사용해주세요.
            </li>
            <li className="text-amber-700">
              ⚠️ <strong>중계 서비스를 고르면 회의 전문이 그 회사 서버를 거칩니다.</strong> OpenAI·Gemini 직접 호출은 해당 회사만, OrcaRouter 같은 라우터는 라우터 운영사 + 실제 모델 제공사 양쪽을 거칩니다. 외부 전송이 곤란하면 <strong>로컬 모델</strong>을 선택하세요.
            </li>
          </ul>
        </section>
      </div>
    </main>
  )
}
