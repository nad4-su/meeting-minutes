'use client'

import { useState } from 'react'
import { AudioUploader } from '@/components/upload/AudioUploader'
import { LiveRecorder } from '@/components/recorder/LiveRecorder'
import { MinutesViewer } from '@/components/minutes/MinutesViewer'

type Tab = 'upload' | 'record'
type SummaryMode = 'simple' | 'gemini'

interface MinutesResult {
  markdown: string
  mode: SummaryMode
}

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('record')
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('simple')
  const [result, setResult] = useState<MinutesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

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

  function handleTranscriptReady(text: string) {
    setTranscript(text)
  }

  async function generateMinutes() {
    if (!transcript.trim()) {
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
          transcript,
          mode: summaryMode,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error)
        return
      }

      setResult({ markdown: data.markdown, mode: data.mode })
    } catch {
      setError('회의록 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex-1 bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
            Meeting Minutes
          </h1>
          <p className="mt-2 text-neutral-500">
            음성을 텍스트로, 텍스트를 회의록으로
          </p>
        </header>

        <section className="mb-8">
          <label className="block text-sm font-medium text-neutral-600 mb-2">
            회의 제목
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 주간 스프린트 회의"
            className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
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
            <LiveRecorder onTranscriptReady={handleTranscriptReady} />
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

        <section className="mb-8">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-neutral-600">
              변환 모드:
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
                Gemini AI 요약
              </button>
            </div>
          </div>
        </section>

        <button
          onClick={generateMinutes}
          disabled={loading || !transcript.trim()}
          className="w-full rounded-xl bg-neutral-900 px-6 py-3.5 text-white font-medium shadow-lg shadow-neutral-900/10 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all mb-8"
        >
          {loading ? '생성 중...' : '회의록 생성'}
        </button>

        {error && (
          <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <MinutesViewer
            markdown={result.markdown}
            title={title || '무제 회의'}
            mode={result.mode}
          />
        )}
      </div>
    </main>
  )
}
