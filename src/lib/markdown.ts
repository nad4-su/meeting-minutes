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

/**
 * 마크다운 → 클립보드에 (text/html + text/plain) 복사.
 * Google Docs / Notion / Word 등에 붙여넣으면 서식이 유지됨.
 *
 * @returns true 복사 성공, false fallback도 실패 시
 */
export async function copyMarkdownAsRichText(
  markdown: string,
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !markdown) return false

  const html = renderMarkdownToSafeHtml(markdown)
  const wrappedHtml = `<div>${html}</div>`

  try {
    if ('clipboard' in navigator && 'write' in navigator.clipboard) {
      const ClipboardItemRef = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      if (ClipboardItemRef) {
        await navigator.clipboard.write([
          new ClipboardItemRef({
            'text/html': new Blob([wrappedHtml], { type: 'text/html' }),
            'text/plain': new Blob([markdown], { type: 'text/plain' }),
          }),
        ])
        return true
      }
    }
  } catch {
    // fall through to legacy path
  }

  // Fallback: 임시 contenteditable로 execCommand
  try {
    const container = document.createElement('div')
    container.contentEditable = 'true'
    container.style.position = 'fixed'
    container.style.opacity = '0'
    container.style.pointerEvents = 'none'
    container.innerHTML = wrappedHtml
    document.body.appendChild(container)
    const range = document.createRange()
    range.selectNodeContents(container)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    const ok = document.execCommand('copy')
    selection?.removeAllRanges()
    container.remove()
    return ok
  } catch {
    return false
  }
}
