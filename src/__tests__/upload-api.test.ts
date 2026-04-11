import { describe, it, expect, vi } from 'vitest'
import { handleUpload } from '@/lib/upload-handler'

describe('handleUpload', () => {
  it('유효한 오디오 파일을 받으면 성공 응답을 반환한다', async () => {
    const file = new File(['audio-content'], 'meeting.mp3', {
      type: 'audio/mpeg',
    })
    const formData = new FormData()
    formData.append('audio', file)
    formData.append('title', '주간 회의')

    const result = await handleUpload(formData)

    expect(result.success).toBe(true)
    expect(result.data?.title).toBe('주간 회의')
    expect(result.data?.fileName).toBe('meeting.mp3')
    expect(result.data?.mimeType).toBe('audio/mpeg')
  })

  it('오디오 파일이 없으면 에러를 반환한다', async () => {
    const formData = new FormData()
    formData.append('title', '빈 회의')

    const result = await handleUpload(formData)

    expect(result.success).toBe(false)
    expect(result.error).toContain('오디오 파일')
  })

  it('유효하지 않은 파일 형식이면 에러를 반환한다', async () => {
    const file = new File(['not-audio'], 'doc.pdf', {
      type: 'application/pdf',
    })
    const formData = new FormData()
    formData.append('audio', file)
    formData.append('title', '잘못된 파일')

    const result = await handleUpload(formData)

    expect(result.success).toBe(false)
    expect(result.error).toContain('지원하지 않는 파일 형식')
  })

  it('제목이 없으면 파일명을 기본 제목으로 사용한다', async () => {
    const file = new File(['audio-content'], 'standup.webm', {
      type: 'audio/webm',
    })
    const formData = new FormData()
    formData.append('audio', file)

    const result = await handleUpload(formData)

    expect(result.success).toBe(true)
    expect(result.data?.title).toBe('standup')
  })
})
