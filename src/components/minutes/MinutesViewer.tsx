'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  exportAsMarkdown,
  exportAsHtml,
  generateDownloadFilename,
} from '@/lib/export-minutes'
import {
  copyMarkdownAsRichText,
  renderMarkdownToSafeHtml,
} from '@/lib/markdown'
import type { SummaryDepth, TemplateId } from '@/lib/templates'

interface MinutesViewerProps {
  markdown: string
  title: string
  mode: 'simple' | 'gemini'
  transcript?: string
  template?: TemplateId
  depth?: SummaryDepth
  customPrompt?: string
  summaryMode?: 'simple' | 'gemini'
  /** 이 회의록의 원본 오디오. 서버에 보관된 녹음이 있을 때만 붙는다. */
  audio?: {
    audioFileName: string
    audioMimeType: string
    audioDuration: number
  }
}

type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; id: string }
  | { status: 'error'; message: string }

export function MinutesViewer({
  markdown,
  title,
  mode,
  transcript,
  template,
  depth,
  customPrompt,
  audio,
  summaryMode,
}: MinutesViewerProps) {
  const [renderedView, setRenderedView] = useState<'rendered' | 'raw'>(
    'rendered',
  )
  const [save, setSave] = useState<SaveState>({ status: 'idle' })
  const [copyHint, setCopyHint] = useState<string | null>(null)

  const renderedHtml = useMemo(
    () => renderMarkdownToSafeHtml(markdown),
    [markdown],
  )

  function download(type: 'md' | 'html') {
    const filename = generateDownloadFilename(title, new Date())

    if (type === 'md') {
      const blob = exportAsMarkdown(markdown)
      triggerDownload(blob, `${filename}.md`)
    } else {
      const html = exportAsHtml(markdown, title)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      triggerDownload(blob, `${filename}.html`)
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(markdown)
      flashCopyHint('마크다운이 클립보드에 복사되었습니다.')
    } catch {
      flashCopyHint('복사에 실패했습니다.')
    }
  }

  async function copyForGoogleDocs() {
    const ok = await copyMarkdownAsRichText(markdown)
    flashCopyHint(
      ok
        ? '서식 유지 복사 완료 — Google Docs/Word/Notion에 붙여넣어보세요.'
        : '서식 복사 실패 — 일반 복사를 사용해주세요.',
    )
  }

  function flashCopyHint(message: string) {
    setCopyHint(message)
    setTimeout(() => setCopyHint(null), 2500)
  }

  async function saveMeeting() {
    setSave({ status: 'saving' })
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          rawTranscript: transcript,
          markdownMinutes: markdown,
          summaryMode: summaryMode ?? mode,
          template,
          depth,
          customPrompt,
          ...audio,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSave({ status: 'error', message: data.error ?? '저장 실패' })
        return
      }
      setSave({ status: 'saved', id: data.id })
    } catch (err) {
      setSave({
        status: 'error',
        message: err instanceof Error ? err.message : '저장 실패',
      })
    }
  }

  const modeLabel = mode === 'gemini' ? 'AI 요약' : '단순 변환'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-800">회의록</h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              mode === 'gemini'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {modeLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-lg bg-neutral-100 p-0.5 text-xs">
            <button
              onClick={() => setRenderedView('rendered')}
              className={`rounded-md px-2 py-1 transition-colors ${
                renderedView === 'rendered'
                  ? 'bg-white text-neutral-800 shadow-sm'
                  : 'text-neutral-500'
              }`}
            >
              미리보기
            </button>
            <button
              onClick={() => setRenderedView('raw')}
              className={`rounded-md px-2 py-1 transition-colors ${
                renderedView === 'raw'
                  ? 'bg-white text-neutral-800 shadow-sm'
                  : 'text-neutral-500'
              }`}
            >
              원문
            </button>
          </div>
          <button
            onClick={copyToClipboard}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
            title="마크다운 원문 복사"
          >
            📋 .md
          </button>
          <button
            onClick={copyForGoogleDocs}
            className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 transition-colors"
            title="서식 유지 복사 (Google Docs/Word/Notion 호환)"
          >
            📋 Docs용
          </button>
          <button
            onClick={() => download('md')}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
          >
            ⬇ .md
          </button>
          <button
            onClick={() => download('html')}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
          >
            ⬇ .html
          </button>
          <button
            onClick={saveMeeting}
            disabled={save.status === 'saving' || save.status === 'saved'}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {save.status === 'saving'
              ? '저장 중...'
              : save.status === 'saved'
              ? '저장됨 ✓'
              : '📌 저장'}
          </button>
        </div>
      </div>

      {save.status === 'saved' && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-700 flex items-center justify-between gap-3">
          <span>회의록이 저장되었습니다.</span>
          <Link
            href={`/meetings/${save.id}`}
            className="underline font-medium hover:text-purple-900"
          >
            상세 보기 →
          </Link>
        </div>
      )}

      {copyHint && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {copyHint}
        </div>
      )}

      {save.status === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          저장 실패: {save.message}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 max-h-[500px] overflow-y-auto">
        {renderedView === 'rendered' ? (
          <div
            className="prose-minutes text-sm text-neutral-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-neutral-700 font-mono leading-relaxed">
            {markdown}
          </pre>
        )}
      </div>
    </div>
  )
}
