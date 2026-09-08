import { describe, it, expect } from 'vitest'
import {
  LOCAL_SPEAKER,
  REMOTE_SPEAKER,
  diarizedSpeakerId,
  listAttendees,
  resolveSpeakerName,
} from '@/lib/speakers'

describe('resolveSpeakerName', () => {
  it('기본 화자에 한국어 표기를 붙인다', () => {
    expect(resolveSpeakerName(LOCAL_SPEAKER)).toBe('나')
    expect(resolveSpeakerName(REMOTE_SPEAKER)).toBe('상대')
  })

  it('사용자가 지정한 이름이 우선한다', () => {
    const names = { [REMOTE_SPEAKER]: '김지훈' }
    expect(resolveSpeakerName(REMOTE_SPEAKER, names)).toBe('김지훈')
    expect(resolveSpeakerName(LOCAL_SPEAKER, names)).toBe('나')
  })

  it('공백뿐인 이름은 무시한다', () => {
    expect(resolveSpeakerName(LOCAL_SPEAKER, { [LOCAL_SPEAKER]: '   ' })).toBe('나')
  })

  it('diarization 화자 번호를 한국어 표기로 바꾼다', () => {
    expect(resolveSpeakerName('spk_1')).toBe('화자 1')
    expect(resolveSpeakerName('spk_3')).toBe('화자 3')
  })

  it('diarization 화자에도 지정 이름이 우선한다', () => {
    expect(resolveSpeakerName('spk_2', { spk_2: '박지연' })).toBe('박지연')
  })

  it('그 밖의 식별자는 그대로 돌려준다', () => {
    expect(resolveSpeakerName('unknown')).toBe('unknown')
  })
})

describe('listAttendees', () => {
  it('중복을 제거하고 순서를 유지한다', () => {
    expect(
      listAttendees([REMOTE_SPEAKER, LOCAL_SPEAKER, REMOTE_SPEAKER]),
    ).toEqual(['상대', '나'])
  })

  it('지정된 이름을 반영한다', () => {
    expect(
      listAttendees([LOCAL_SPEAKER, REMOTE_SPEAKER], {
        [LOCAL_SPEAKER]: '배철승',
        [REMOTE_SPEAKER]: '김지훈',
      }),
    ).toEqual(['배철승', '김지훈'])
  })
})

describe('diarizedSpeakerId', () => {
  it('0-based 번호를 1-based 식별자로 바꾼다', () => {
    expect(diarizedSpeakerId(0)).toBe('spk_1')
    expect(diarizedSpeakerId(3)).toBe('spk_4')
  })
})
