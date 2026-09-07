'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AudioUploader } from '@/components/upload/AudioUploader'
import { LiveRecorder } from '@/components/recorder/LiveRecorder'
import { MinutesViewer } from '@/components/minutes/MinutesViewer'
import { getProviderRequestPayload } from '@/lib/api-key-storage'
import {
  TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  DEFAULT_DEPTH,
  depthAdjustableFor,
  liveEnabledFor,
  type SummaryDepth,
  type TemplateId,
} from '@/lib/templates'

type Tab = 'upload' | 'record'
type SummaryMode = 'simple' | 'gemini'

interface MinutesResult {
  markdown: string
  mode: SummaryMode
  warning?: string
}

const DEPTH_LABELS: Record<SummaryDepth, string> = {
  concise: '간결',
  standard: '표준',
  detailed: '상세',
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('record')
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('gemini')
  const [template, setTemplate] = useState<TemplateId>(DEFAULT_TEMPLATE_ID)
  const [depth, setDepth] = useState<SummaryDepth>(DEFAULT_DEPTH)
  const [customPrompt, setCustomPrompt] = useState('')
  const [result, setResult] = useState<MinutesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const templateList = useMemo(
    () => [
      ...Object.values(TEMPLATES),
      {
        id: 'custom' as const,
        name: '커스텀',
        icon: '⚙️',
        description: '직접 프롬프트 작성',
      },
    ],
    [],
  )

  const activeTemplateMeta = useMemo(() => {
    if (template === 'custom') {
      return { adjustable: false, live: true }
    }
    return {
      adjustable: depthAdjustableFor(template),
      live: liveEnabledFor(template),
    }
  }, [template])

  function handleTemplateChange(id: TemplateId) {
    setTemplate(id)
    if (id !== 'custom') {
      const tpl = TEMPLATES[id]
      setDepth(tpl.defaultDepth)
    }
  }

  async function handleUpload(file: File) {
    setUploadedFile(file)
    setError(null)

    const formData = new FormData()
    formData.append('audio', file)
    formData.append('title', title || file.name.replace(/\.[^.]+$/, ''))

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      if (!title) setTitle(data.title)
    } catch {
      setError('파일 업로드에 실패했습니다.')
    }
  }

  async function generateMinutes(sourceTranscript: string, mode: SummaryMode) {
    const text = sourceTranscript.trim()
    if (!text) {
      setError('변환할 텍스트가 없습니다. 녹음하거나 파일을 업로드해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || '무제 회의',
          transcript: text,
          mode,
          template,
          depth,
          customPrompt: template === 'custom' ? customPrompt : undefined,
          ...getProviderRequestPayload(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setResult({
        markdown: data.markdown,
        mode: data.mode,
        warning: data.warning,
      })
    } catch {
      setError('회의록 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handleTranscriptReady(text: string) {
    setTranscript(text)
    generateMinutes(text, summaryMode)
  }

  const liveSummaryActive =
    summaryMode === 'gemini' && activeTemplateMeta.live && tab === 'record'

  return (
    <main className="flex-1 bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 text-center relative">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
            Meeting Minutes
          </h1>
          <p className="mt-2 text-neutral-500">
            음성을 텍스트로, 용도에 맞는 템플릿으로 정리
          </p>
          <div className="absolute right-0 top-1 flex gap-3 text-sm text-neutral-500">
            <Link
              href="/meetings"
              className="hover:text-neutral-800 transition-colors"
            >
              📚 회의록
            </Link>
            <Link
              href="/settings"
              className="hover:text-neutral-800 transition-colors"
            >
              ⚙️ 설정
            </Link>
          </div>
        </header>

        <section className="mb-8">
          <label className="block text-sm font-medium text-neutral-600 mb-2">
            제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 주간 스프린트 회의"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </section>

        <section className="mb-8 space-y-5">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-neutral-600 min-w-20">
              변환 모드
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSummaryMode('simple')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  summaryMode === 'simple'
                    ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                단순 변환
              </button>
              <button
                onClick={() => setSummaryMode('gemini')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  summaryMode === 'gemini'
                    ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                AI 요약
              </button>
            </div>
          </div>

          {summaryMode === 'gemini' && (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-600 mb-2">
                  템플릿
                </label>
                <div className="flex flex-wrap gap-2">
                  {templateList.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => handleTemplateChange(tpl.id)}
                      title={tpl.description}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                        template === tpl.id
                          ? 'border-purple-400 bg-purple-50 text-purple-700'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="mr-1">{tpl.icon}</span>
                      {tpl.name}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-neutral-500">
                  {template === 'custom'
                    ? '직접 프롬프트 작성'
                    : TEMPLATES[template]?.description}
                </p>
              </div>

              {activeTemplateMeta.adjustable && (
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-neutral-600 min-w-20">
                    작성 강도
                  </label>
                  <div className="flex gap-2">
                    {(['concise', 'standard', 'detailed'] as const).map(
                      (d) => (
                        <button
                          key={d}
                          onClick={() => setDepth(d)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                            depth === d
                              ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300'
                              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                          }`}
                        >
                          {DEPTH_LABELS[d]}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {template === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-2">
                    커스텀 프롬프트
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="예: 당신은 기술 문서 작성자입니다. 아래 내용을 개발자 가이드 형식으로..."
                    rows={4}
                    className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all resize-y"
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    비워두면 회의록 템플릿이 적용됩니다.
                  </p>
                </div>
              )}

              {tab === 'record' && (
                <p className="text-xs text-purple-600">
                  {liveSummaryActive
                    ? '💡 녹음 중 30초마다 중간 정리가 자동 갱신되고, 종료 시 최종 문서가 생성됩니다.'
                    : '💡 이 템플릿은 녹음 종료 시 한 번만 생성됩니다.'}
                </p>
              )}
            </>
          )}
        </section>

        <section className="mb-8">
          <div className="flex gap-1 rounded-xl bg-neutral-100 p-1 mb-6">
            <button
              onClick={() => setTab('record')}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                tab === 'record'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              실시간 녹음
            </button>
            <button
              onClick={() => setTab('upload')}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
                tab === 'upload'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              파일 업로드
            </button>
          </div>

          {tab === 'record' ? (
            <LiveRecorder
              onTranscriptReady={handleTranscriptReady}
              liveSummaryEnabled={liveSummaryActive}
              template={template}
              depth={depth}
              customPrompt={template === 'custom' ? customPrompt : undefined}
            />
          ) : (
            <AudioUploader onFileSelected={handleUpload} />
          )}
        </section>

        {transcript && (
          <section className="mb-8">
            <label className="block text-sm font-medium text-neutral-600 mb-2">
              인식된 텍스트
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm font-mono text-neutral-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all resize-y"
            />
          </section>
        )}

        {uploadedFile && !transcript && (
          <section className="mb-8">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
              <strong>{uploadedFile.name}</strong> 업로드 완료.
              실시간 녹음 탭에서 음성 인식을 시작하거나, 텍스트를 직접 입력해주세요.
            </div>
          </section>
        )}

        <button
          onClick={() => generateMinutes(transcript, summaryMode)}
          disabled={loading || !transcript.trim()}
          className="w-full rounded-xl bg-neutral-900 px-6 py-3.5 text-white font-medium shadow-lg shadow-neutral-900/10 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-8"
        >
          {loading ? '생성 중...' : result ? '재생성' : '생성'}
        </button>

        {error && (
          <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result?.warning && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {result.warning}
          </div>
        )}

        {result && (
          <MinutesViewer
            markdown={result.markdown}
            title={title || '무제 회의'}
            mode={result.mode}
            transcript={transcript}
            template={template}
            depth={depth}
            customPrompt={template === 'custom' ? customPrompt : undefined}
            summaryMode={summaryMode}
          />
        )}
      </div>
    </main>
  )
}
