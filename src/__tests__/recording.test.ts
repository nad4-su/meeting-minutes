import { describe, it, expect } from 'vitest'
import {
  PREFERRED_MIME_TYPES,
  RECORDING_AUDIO_CONSTRAINTS,
  extensionForMimeType,
  formatBytes,
  formatDuration,
  isValidRecordingId,
  pickRecorderMimeType,
  recordingDownloadName,
} from '@/lib/recording'

describe('pickRecorderMimeType', () => {
  it('가장 앞선 후보를 고른다', () => {
    const picked = pickRecorderMimeType(() => true)
    expect(picked).toBe(PREFERRED_MIME_TYPES[0])
  })

  it('지원하지 않는 후보는 건너뛴다', () => {
    const picked = pickRecorderMimeType((type) => type === 'audio/mp4')
    expect(picked).toBe('audio/mp4')
  })

  it('아무것도 지원하지 않으면 null', () => {
    expect(pickRecorderMimeType(() => false)).toBeNull()
  })
})

describe('extensionForMimeType', () => {
  it('코덱 파라미터를 떼고 판단한다', () => {
    expect(extensionForMimeType('audio/webm;codecs=opus')).toBe('webm')
    expect(extensionForMimeType('audio/ogg; codecs=opus')).toBe('ogg')
  })

  it('주요 컨테이너를 매핑한다', () => {
    expect(extensionForMimeType('audio/webm')).toBe('webm')
    expect(extensionForMimeType('audio/mp4')).toBe('m4a')
    expect(extensionForMimeType('audio/mpeg')).toBe('mp3')
    expect(extensionForMimeType('audio/wav')).toBe('wav')
  })

  it('대소문자를 가리지 않는다', () => {
    expect(extensionForMimeType('AUDIO/WEBM')).toBe('webm')
  })

  it('모르는 형식은 bin으로 떨어진다', () => {
    expect(extensionForMimeType('application/octet-stream')).toBe('bin')
  })
})

describe('isValidRecordingId', () => {
  const valid = 'a'.repeat(32)

  it('32자 hex만 통과시킨다', () => {
    expect(isValidRecordingId(valid)).toBe(true)
    expect(isValidRecordingId('0123456789abcdef0123456789abcdef')).toBe(true)
  })

  it('경로 조작 시도를 막는다', () => {
    expect(isValidRecordingId('../../etc/passwd')).toBe(false)
    expect(isValidRecordingId(`${valid}/../x`)).toBe(false)
    expect(isValidRecordingId('..')).toBe(false)
    expect(isValidRecordingId(`../${valid}`)).toBe(false)
  })

  it('길이나 문자셋이 어긋나면 거부한다', () => {
    expect(isValidRecordingId('a'.repeat(31))).toBe(false)
    expect(isValidRecordingId('a'.repeat(33))).toBe(false)
    expect(isValidRecordingId('A'.repeat(32))).toBe(false)
    expect(isValidRecordingId('g'.repeat(32))).toBe(false)
    expect(isValidRecordingId('')).toBe(false)
  })

  it('문자열이 아니면 거부한다', () => {
    expect(isValidRecordingId(null)).toBe(false)
    expect(isValidRecordingId(undefined)).toBe(false)
    expect(isValidRecordingId(123)).toBe(false)
  })
})

describe('recordingDownloadName', () => {
  const at = new Date(2026, 8, 8, 14, 5)

  it('날짜와 제목을 붙인다', () => {
    expect(recordingDownloadName('주간 회의', at, 'audio/webm')).toBe(
      '20260908-1405_주간_회의.webm',
    )
  })

  it('제목이 없으면 날짜만 쓴다', () => {
    expect(recordingDownloadName('   ', at, 'audio/webm')).toBe(
      '20260908-1405.webm',
    )
  })

  it('파일명에 못 쓰는 문자를 지운다', () => {
    const name = recordingDownloadName('a/b\\c:d*e?f"g<h>i|j', at, 'audio/webm')
    expect(name).toBe('20260908-1405_abcdefghij.webm')
    expect(name).not.toMatch(/[\\/:*?"<>|]/)
  })

  it('아주 긴 제목을 자른다', () => {
    const name = recordingDownloadName('가'.repeat(200), at, 'audio/webm')
    expect(name.length).toBeLessThan(90)
  })
})

describe('formatBytes', () => {
  it('단위를 바꿔가며 표기한다', () => {
    expect(formatBytes(512)).toBe('512B')
    expect(formatBytes(2048)).toBe('2KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0MB')
  })

  it('비정상 값은 0으로 떨어진다', () => {
    expect(formatBytes(-1)).toBe('0B')
    expect(formatBytes(NaN)).toBe('0B')
  })
})

describe('formatDuration', () => {
  it('한 시간 미만은 분:초', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(65_000)).toBe('01:05')
    expect(formatDuration(46 * 60_000 + 6_000)).toBe('46:06')
  })

  it('한 시간 이상은 시:분:초', () => {
    expect(formatDuration(3_600_000)).toBe('1:00:00')
    expect(formatDuration(3_725_000)).toBe('1:02:05')
  })

  it('음수는 0으로 본다', () => {
    expect(formatDuration(-5_000)).toBe('00:00')
  })
})

describe('RECORDING_AUDIO_CONSTRAINTS', () => {
  it('원거리 화자를 지우는 전처리를 끈다', () => {
    // 46분 대면 회의에서 포착률이 10% 안팎에 그친 원인 중 하나.
    // 이 값이 다시 true로 돌아가면 회귀다.
    expect(RECORDING_AUDIO_CONSTRAINTS.noiseSuppression).toBe(false)
    expect(RECORDING_AUDIO_CONSTRAINTS.echoCancellation).toBe(false)
  })

  it('조용한 화자를 끌어올리는 AGC는 남긴다', () => {
    expect(RECORDING_AUDIO_CONSTRAINTS.autoGainControl).toBe(true)
  })
})
