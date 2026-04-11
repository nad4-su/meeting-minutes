'use client'

import { exportAsMarkdown, exportAsHtml, generateDownloadFilename } from '@/lib/export-minutes'

interface MinutesViewerProps {
  markdown: string
  title: string
  mode: 'simple' | 'gemini'
}

export function MinutesViewer({ markdown, title, mode }: MinutesViewerProps) {
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
    URL.revokeObjectURL(url)
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(markdown)
  }

  const modeLabel = mode === 'gemini' ? 'Gemini AI 요약' : '단순 변환'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-800">회의록</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            mode === 'gemini'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {modeLabel}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
          >
            복사
          </button>
          <button
            onClick={() => download('md')}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
          >
            .md 다운로드
          </button>
          <button
            onClick={() => download('html')}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 transition-colors"
          >
            .html 다운로드
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 max-h-[500px] overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm text-neutral-700 font-mono leading-relaxed">
          {markdown}
        </pre>
      </div>
    </div>
  )
}
