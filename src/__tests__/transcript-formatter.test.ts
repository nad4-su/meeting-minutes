import { describe, it, expect } from 'vitest'
import {
  formatTranscriptChunks,
  mergeAdjacentChunks,
  type TranscriptChunk,
} from '@/lib/transcript-formatter'

describe('formatTranscriptChunks', () => {
  it('타임스탬프가 있는 청크를 텍스트로 변환한다', () => {
    const chunks: TranscriptChunk[] = [
      { text: '안녕하세요', startTime: 0, endTime: 2.5, isFinal: true },
      { text: '오늘 회의를 시작하겠습니다', startTime: 2.5, endTime: 5.0, isFinal: true },
    ]

    const result = formatTranscriptChunks(chunks)

    expect(result).toContain('[00:00]')
    expect(result).toContain('안녕하세요')
    expect(result).toContain('[00:02]')
    expect(result).toContain('오늘 회의를 시작하겠습니다')
  })

  it('빈 배열이면 빈 문자열을 반환한다', () => {
    const result = formatTranscriptChunks([])
    expect(result).toBe('')
  })

  it('1시간 이상일 때 시:분:초 형식을 사용한다', () => {
    const chunks: TranscriptChunk[] = [
      { text: '긴 회의', startTime: 3661, endTime: 3665, isFinal: true },
    ]

    const result = formatTranscriptChunks(chunks)
    expect(result).toContain('[01:01:01]')
  })
})

describe('mergeAdjacentChunks', () => {
  it('2초 이내의 인접 청크를 병합한다', () => {
    const chunks: TranscriptChunk[] = [
      { text: '안녕', startTime: 0, endTime: 1, isFinal: true },
      { text: '하세요', startTime: 1.1, endTime: 2, isFinal: true },
      { text: '다음 주제입니다', startTime: 10, endTime: 12, isFinal: true },
    ]

    const merged = mergeAdjacentChunks(chunks, 2)

    expect(merged).toHaveLength(2)
    expect(merged[0].text).toBe('안녕 하세요')
    expect(merged[1].text).toBe('다음 주제입니다')
  })

  it('빈 배열이면 빈 배열을 반환한다', () => {
    const result = mergeAdjacentChunks([], 2)
    expect(result).toEqual([])
  })
})
