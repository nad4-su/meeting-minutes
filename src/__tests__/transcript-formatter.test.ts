import { describe, it, expect } from 'vitest'
import {
  formatTranscriptChunks,
  mergeAdjacentChunks,
  mergeSpeakerChunks,
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

describe('화자 표기', () => {
  it('speaker가 있으면 이름을 붙여 출력한다', () => {
    const out = formatTranscriptChunks([
      { text: '안녕하세요', startTime: 0, endTime: 2, isFinal: true, speaker: 'local' },
      { text: '네 반갑습니다', startTime: 3, endTime: 5, isFinal: true, speaker: 'remote' },
    ])
    expect(out).toBe('[00:00] 나: 안녕하세요\n[00:03] 상대: 네 반갑습니다')
  })

  it('지정된 화자 이름을 사용한다', () => {
    const out = formatTranscriptChunks(
      [{ text: '안녕하세요', startTime: 0, endTime: 2, isFinal: true, speaker: 'remote' }],
      { remote: '김지훈' },
    )
    expect(out).toBe('[00:00] 김지훈: 안녕하세요')
  })

  it('speaker가 없으면 기존 형식을 유지한다', () => {
    const out = formatTranscriptChunks([
      { text: '안녕하세요', startTime: 0, endTime: 2, isFinal: true },
    ])
    expect(out).toBe('[00:00] 안녕하세요')
  })
})

describe('mergeSpeakerChunks', () => {
  const local = [
    { text: '먼저 말함', startTime: 1, endTime: 2, isFinal: true, speaker: 'local' },
    { text: '나중에 말함', startTime: 9, endTime: 10, isFinal: true, speaker: 'local' },
  ]
  const remote = [
    { text: '중간에 답함', startTime: 4, endTime: 6, isFinal: true, speaker: 'remote' },
  ]

  it('여러 트랙을 시간순으로 합친다', () => {
    expect(mergeSpeakerChunks(local, remote).map((c) => c.text)).toEqual([
      '먼저 말함',
      '중간에 답함',
      '나중에 말함',
    ])
  })

  it('같은 시각이면 넘긴 순서를 유지한다', () => {
    const a = [{ text: 'A', startTime: 5, endTime: 6, isFinal: true, speaker: 'local' }]
    const b = [{ text: 'B', startTime: 5, endTime: 6, isFinal: true, speaker: 'remote' }]
    expect(mergeSpeakerChunks(a, b).map((c) => c.text)).toEqual(['A', 'B'])
  })

  it('빈 트랙을 섞어도 동작한다', () => {
    expect(mergeSpeakerChunks([], remote, [])).toEqual(remote)
    expect(mergeSpeakerChunks()).toEqual([])
  })
})

describe('mergeAdjacentChunks — 화자 경계', () => {
  it('화자가 다르면 간격이 좁아도 합치지 않는다', () => {
    const merged = mergeAdjacentChunks(
      [
        { text: '그건', startTime: 0, endTime: 1, isFinal: true, speaker: 'local' },
        { text: '어렵습니다', startTime: 1, endTime: 2, isFinal: true, speaker: 'remote' },
      ],
      5,
    )
    expect(merged).toHaveLength(2)
  })

  it('같은 화자면 기존대로 합친다', () => {
    const merged = mergeAdjacentChunks(
      [
        { text: '그건', startTime: 0, endTime: 1, isFinal: true, speaker: 'local' },
        { text: '가능합니다', startTime: 1, endTime: 2, isFinal: true, speaker: 'local' },
      ],
      5,
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].text).toBe('그건 가능합니다')
    expect(merged[0].speaker).toBe('local')
  })
})
