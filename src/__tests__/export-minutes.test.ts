import { describe, it, expect } from 'vitest'
import {
  exportAsMarkdown,
  exportAsHtml,
  generateDownloadFilename,
} from '@/lib/export-minutes'

const sampleMarkdown = `# 주간 회의

**날짜**: 2026-04-11

---

## 회의 내용

[00:00] 안녕하세요
[00:05] 회의를 시작합니다
`

describe('exportAsMarkdown', () => {
  it('마크다운 문자열을 Blob으로 변환한다', () => {
    const blob = exportAsMarkdown(sampleMarkdown)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('text/markdown;charset=utf-8')
  })

  it('빈 문자열도 유효한 Blob을 반환한다', () => {
    const blob = exportAsMarkdown('')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBe(0)
  })
})

describe('exportAsHtml', () => {
  it('마크다운을 HTML 문서로 변환한다', () => {
    const html = exportAsHtml(sampleMarkdown, '주간 회의')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<title>주간 회의</title>')
    expect(html).toContain('주간 회의')
  })

  it('Google Docs 호환 스타일을 포함한다', () => {
    const html = exportAsHtml(sampleMarkdown, '테스트')
    expect(html).toContain('<style>')
    expect(html).toContain('font-family')
  })
})

describe('generateDownloadFilename', () => {
  it('제목과 날짜로 파일명을 생성한다', () => {
    const filename = generateDownloadFilename('주간 회의', new Date('2026-04-11'))
    expect(filename).toBe('주간_회의_2026-04-11')
  })

  it('특수문자를 언더스코어로 치환한다', () => {
    const filename = generateDownloadFilename('회의/미팅 #1', new Date('2026-04-11'))
    expect(filename).toBe('회의_미팅__1_2026-04-11')
  })
})
