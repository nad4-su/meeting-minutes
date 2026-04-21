'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { renderMarkdownToSafeHtml } from '@/lib/markdown'
import {
  exportAsMarkdown,
  exportAsHtml,
  generateDownloadFilename,
} from '@/lib/export-minutes'

export interface MeetingDetailData {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  markdownMinutes: string | null
  rawTranscript: string | null
  template: string | null
  summaryMode: string | null
  depth: string | null
  attendees: string[]
  tags: string[]
}

interface MeetingDetailProps {
  meeting: MeetingDetailData
}

type EditState =
  | { status: 'view' }
  | { status: 'editing' }
  | { status: 'saving' }
  | { status: 'error'; message: string }

export function MeetingDetail({ meeting }: MeetingDetailProps) {
  const router = useRouter()

  const [title, setTitle] = useState(meeting.title)
  const [markdown, setMarkdown] = useState(meeting.markdownMinutes ?? '')
  const [attendees, setAttendees] = useState(meeting.attendees.join(', '))
  const [tags, setTags] = useState(meeting.tags.join(', '))
  const [state, setState] = useState<EditState>({ status: 'view' })

  const renderedHtml = useMemo(
    () => renderMarkdownToSafeHtml(markdown),
    [markdown],
  )

  const isDirty =
    title !== meeting.title ||
    markdown !== (meeting.markdownMinutes ?? '') ||
    attendees !== meeting.attendees.join(', ') ||
    tags !== meeting.tags.join(', ')

  async function handleSave() {
    setState({ status: 'saving' })
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          markdownMinutes: markdown,
          attendees: attendees
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '저장 실패' }))
        setState({ status: 'error', message: data.error ?? '저장 실패' })
        return
      }
      setState({ status: 'view' })
      router.refresh()
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : '저장 실패',
      })
    }
  }

  async function handleDelete() {
    if (!confirm('이 회의록을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: 'DELETE',
      })
      if (res.ok || res.status === 204) {
        router.push('/meetings')
      }
    } catch {
      // no-op
    }
  }

  function handleDownload(type: 'md' | 'html') {
    const filename = generateDownloadFilename(title, new Date(meeting.createdAt))
    if (type === 'md') {
      const blob = exportAsMarkdown(markdown)
      trigger(blob, `${filename}.md`)
    } else {
      const html = exportAsHtml(markdown, title)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      trigger(blob, `${filename}.html`)
    }
  }

  function trigger(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const isEditing = state.status === 'editing' || state.status === 'saving'

  return (
    <main className="flex-1 bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/meetings"
            className="text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            ← 목록으로
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload('md')}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
            >
              .md
            </button>
            <button
              onClick={() => handleDownload('html')}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
            >
              .html
            </button>
            {!isEditing ? (
              <button
                onClick={() => setState({ status: 'editing' })}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
              >
                ✏️ 편집
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setTitle(meeting.title)
                    setMarkdown(meeting.markdownMinutes ?? '')
                    setAttendees(meeting.attendees.join(', '))
                    setTags(meeting.tags.join(', '))
                    setState({ status: 'view' })
                  }}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isDirty || state.status === 'saving'}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {state.status === 'saving' ? '저장 중...' : '저장'}
                </button>
              </>
            )}
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>

        {state.status === 'error' && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.message}
          </div>
        )}

        {isEditing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mb-4 w-full text-3xl font-bold tracking-tight text-neutral-900 bg-transparent focus:outline-none border-b border-dashed border-neutral-300 pb-1 focus:border-purple-400"
          />
        ) : (
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-neutral-900">
            {meeting.title}
          </h1>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
          <span>
            📅 {new Intl.DateTimeFormat('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(meeting.createdAt))}
          </span>
          {meeting.template && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
              {meeting.template}
              {meeting.depth && ` · ${meeting.depth}`}
            </span>
          )}
          {meeting.summaryMode && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                meeting.summaryMode === 'gemini'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {meeting.summaryMode === 'gemini' ? 'Gemini' : '단순'}
            </span>
          )}
        </div>

        {isEditing && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                참석자 (쉼표 구분)
              </label>
              <input
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="이름1, 이름2"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                태그 (쉼표 구분)
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="sprint, review"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>
        )}

        {!isEditing &&
          ((meeting.attendees.length ?? 0) > 0 ||
            (meeting.tags.length ?? 0) > 0) && (
            <div className="mb-6 space-y-1 text-sm text-neutral-600">
              {meeting.attendees.length > 0 && (
                <p>👤 {meeting.attendees.join(', ')}</p>
              )}
              {meeting.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {meeting.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

        {isEditing ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                마크다운 편집
              </label>
              <textarea
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                className="w-full h-[500px] rounded-xl border border-neutral-300 px-4 py-3 text-sm font-mono text-neutral-700 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">
                미리보기
              </label>
              <div className="w-full h-[500px] rounded-xl border border-neutral-200 bg-white px-5 py-4 overflow-y-auto">
                <div
                  className="prose-minutes text-sm text-neutral-800 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div
              className="prose-minutes text-sm text-neutral-800 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        )}

        {meeting.rawTranscript && (
          <details className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <summary className="cursor-pointer text-sm font-medium text-neutral-600">
              원본 transcript 보기
            </summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs font-mono text-neutral-600 leading-relaxed">
              {meeting.rawTranscript}
            </pre>
          </details>
        )}
      </div>
    </main>
  )
}
