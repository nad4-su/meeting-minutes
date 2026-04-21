import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdownToSafeHtml(markdown: string): string {
  if (!markdown) return ''
  const rawHtml = marked.parse(markdown) as string
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
  })
}

export function markdownToPlainText(markdown: string, maxLength = 160): string {
  const html = marked.parse(markdown) as string
  const stripped = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength) + '...'
}
