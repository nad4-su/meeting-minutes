import { describe, it, expect } from 'vitest'
import {
  validateAudioFile,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/audio-validation'

describe('validateAudioFile', () => {
  it('허용된 오디오 파일을 통과시킨다', () => {
    const file = new File(['audio-data'], 'meeting.mp3', { type: 'audio/mpeg' })
    const result = validateAudioFile(file)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('허용되지 않은 MIME 타입을 거부한다', () => {
    const file = new File(['data'], 'meeting.exe', {
      type: 'application/x-msdownload',
    })
    const result = validateAudioFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('지원하지 않는 파일 형식')
  })

  it('파일 크기 초과를 거부한다', () => {
    const bigData = new Uint8Array(MAX_FILE_SIZE_BYTES + 1)
    const file = new File([bigData], 'huge.mp3', { type: 'audio/mpeg' })
    const result = validateAudioFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('파일 크기')
  })

  it('빈 파일을 거부한다', () => {
    const file = new File([], 'empty.mp3', { type: 'audio/mpeg' })
    const result = validateAudioFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('비어 있습니다')
  })

  it('WAV 파일을 허용한다', () => {
    const file = new File(['wav-data'], 'meeting.wav', { type: 'audio/wav' })
    const result = validateAudioFile(file)
    expect(result.valid).toBe(true)
  })

  it('WebM 오디오를 허용한다', () => {
    const file = new File(['webm-data'], 'meeting.webm', {
      type: 'audio/webm',
    })
    const result = validateAudioFile(file)
    expect(result.valid).toBe(true)
  })

  it('M4A 파일을 허용한다', () => {
    const file = new File(['m4a-data'], 'meeting.m4a', { type: 'audio/mp4' })
    const result = validateAudioFile(file)
    expect(result.valid).toBe(true)
  })
})

describe('ALLOWED_MIME_TYPES', () => {
  it('주요 오디오 형식을 포함한다', () => {
    expect(ALLOWED_MIME_TYPES).toContain('audio/mpeg')
    expect(ALLOWED_MIME_TYPES).toContain('audio/wav')
    expect(ALLOWED_MIME_TYPES).toContain('audio/webm')
    expect(ALLOWED_MIME_TYPES).toContain('audio/mp4')
    expect(ALLOWED_MIME_TYPES).toContain('audio/ogg')
  })
})

describe('MAX_FILE_SIZE_BYTES', () => {
  it('500MB로 설정되어 있다', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(500 * 1024 * 1024)
  })
})
