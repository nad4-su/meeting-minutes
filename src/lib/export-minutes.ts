export function exportAsMarkdown(markdown: string): Blob {
  return new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
}

export function exportAsHtml(markdown: string, title: string): string {
  const lines = markdown.split('\n')
  const bodyHtml = lines
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`
      if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`
      if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`
      if (line.startsWith('---')) return '<hr>'
      if (line.startsWith('- ')) return `<li>${escapeHtml(line.slice(2))}</li>`
      if (line.startsWith('**') && line.endsWith('**'))
        return `<p><strong>${escapeHtml(line.slice(2, -2))}</strong></p>`
      if (line.trim() === '') return ''
      return `<p>${escapeHtml(line)}</p>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: 'Noto Sans KR', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    h1 { font-size: 1.8rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { font-size: 1.4rem; color: #555; margin-top: 1.5rem; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.5rem 0; }
    p { margin: 0.5rem 0; }
    li { margin: 0.3rem 0; }
  </style>
</head>
<body>
${bodyHtml}
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
