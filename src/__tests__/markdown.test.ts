import { describe, it, expect } from 'vitest'
import {
  renderMarkdownToSafeHtml,
  markdownToPlainText,
} from '@/lib/markdown'

describe('renderMarkdownToSafeHtml', () => {
  it('헤딩/리스트/굵은 글씨를 HTML로 변환한다', () => {
    const html = renderMarkdownToSafeHtml(`# 제목
- 항목1
- **중요** 항목2`)
    expect(html).toContain('<h1>제목</h1>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<strong>중요</strong>')
  })

  it('GFM 체크박스를 렌더한다', () => {
    const html = renderMarkdownToSafeHtml('- [ ] 할 일\n- [x] 완료')
    expect(html).toContain('type="checkbox"')
  })

  it('코드 블록을 pre><code>로 감싼다', () => {
    const html = renderMarkdownToSafeHtml('```\nconst x = 1\n```')
    expect(html).toContain('<pre>')
    expect(html).toContain('<code>')
  })

  it('인라인 HTML 스크립트는 살균되어 제거된다', () => {
    const html = renderMarkdownToSafeHtml(
      '안녕 <script>alert("xss")</script> 세계',
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert')
  })

  it('onerror 속성 같은 이벤트 핸들러는 살균된다', () => {
    const html = renderMarkdownToSafeHtml(
      '<img src="x" onerror="alert(1)">',
    )
    expect(html).not.toContain('onerror')
  })

  it('빈 문자열은 빈 문자열을 반환한다', () => {
    expect(renderMarkdownToSafeHtml('')).toBe('')
  })
})

describe('markdownToPlainText', () => {
  it('마크다운을 스트립하여 평문을 반환한다', () => {
    const text = markdownToPlainText('# 제목\n**굵은** 글씨와 [링크](http://x.com)')
    expect(text).toContain('제목')
    expect(text).toContain('굵은')
    expect(text).toContain('링크')
    expect(text).not.toContain('#')
    expect(text).not.toContain('**')
  })

  it('길이 초과 시 말줄임표를 붙인다', () => {
    const long = 'a '.repeat(200)
    const text = markdownToPlainText(long, 20)
    expect(text.endsWith('...')).toBe(true)
    expect(text.length).toBeLessThanOrEqual(23)
  })

  it('연속 공백은 하나로 줄어든다', () => {
    const text = markdownToPlainText('A\n\n\nB\n\n\nC')
    expect(text).toBe('A B C')
  })
})
