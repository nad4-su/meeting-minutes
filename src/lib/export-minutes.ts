import { renderMarkdownToSafeHtml } from './markdown'

export function exportAsMarkdown(markdown: string): Blob {
  return new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
}

export function exportAsHtml(markdown: string, title: string): string {
  const body = renderMarkdownToSafeHtml(markdown)

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.7;
      color: #1f2937;
    }
    h1 { font-size: 1.9rem; border-bottom: 2px solid #1f2937; padding-bottom: 0.5rem; margin-top: 0; }
    h2 { font-size: 1.4rem; color: #374151; margin-top: 2rem; }
    h3 { font-size: 1.15rem; color: #4b5563; margin-top: 1.5rem; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
    p { margin: 0.75rem 0; }
    ul, ol { margin: 0.5rem 0; padding-left: 1.5rem; }
    li { margin: 0.25rem 0; }
    li > input[type="checkbox"] { margin-right: 0.4rem; }
    code {
      background: #f3f4f6;
      padding: 0.1rem 0.35rem;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre {
      background: #f9fafb;
      padding: 0.9rem;
      border-radius: 6px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid #d1d5db;
      margin: 0.75rem 0;
      padding: 0.25rem 0 0.25rem 1rem;
      color: #4b5563;
    }
    table { border-collapse: collapse; margin: 0.75rem 0; }
    th, td { border: 1px solid #e5e7eb; padding: 0.4rem 0.75rem; }
    th { background: #f9fafb; }
  </style>
</head>
<body>
${body}
</body>
</html>`
}

export function generateDownloadFilename(title: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0]
  const sanitized = title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_').replace(/\s+/g, '_')
  return `${sanitized}_${dateStr}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
