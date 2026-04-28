import { describe, it, expect } from 'vitest'
import { parseActionItems } from '@/lib/action-items'

describe('parseActionItems', () => {
  it('마크다운에서 - [ ] / - [x] 항목을 추출한다', () => {
    const md = `## 액션 아이템
- [ ] QA 일정 확정
- [x] PR 머지
- [ ] 다음 주 발표 자료 준비`
    const result = parseActionItems(md)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ task: 'QA 일정 확정', isDone: false })
    expect(result[1]).toEqual({ task: 'PR 머지', isDone: true })
    expect(result[2]).toEqual({
      task: '다음 주 발표 자료 준비',
      isDone: false,
    })
  })

  it('대문자 X 도 done으로 인식', () => {
    const result = parseActionItems('- [X] 완료')
    expect(result).toEqual([{ task: '완료', isDone: true }])
  })

  it('* 불릿도 인식한다', () => {
    const result = parseActionItems('* [ ] 별표 항목')
    expect(result).toEqual([{ task: '별표 항목', isDone: false }])
  })

  it('체크박스 없는 일반 불릿은 무시한다', () => {
    const md = `- 그냥 불릿
- [ ] 액션 아이템
- 또 일반 불릿`
    const result = parseActionItems(md)
    expect(result).toHaveLength(1)
    expect(result[0].task).toBe('액션 아이템')
  })

  it('빈 task / 매우 짧은 task / 점만 있는 task 는 제외', () => {
    const md = `- [ ]
- [ ] a
- [ ] ...
- [ ] 정상 항목`
    const result = parseActionItems(md)
    expect(result).toHaveLength(1)
    expect(result[0].task).toBe('정상 항목')
  })

  it('섹션과 무관하게 모든 체크박스를 수집', () => {
    const md = `## 요약
이것저것

## 회의 내용
- [ ] 본문에 있는 항목

## 다른 섹션
- [x] 다른 섹션의 항목`
    const result = parseActionItems(md)
    expect(result).toHaveLength(2)
  })

  it('빈 문자열은 빈 배열', () => {
    expect(parseActionItems('')).toEqual([])
    expect(parseActionItems('# 제목만 있음')).toEqual([])
  })

  it('들여쓰기된 체크박스도 인식', () => {
    const result = parseActionItems('  - [ ] 들여쓰기')
    expect(result).toEqual([{ task: '들여쓰기', isDone: false }])
  })
})
