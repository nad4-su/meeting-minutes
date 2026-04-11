import { validateAudioFile } from './audio-validation'

type UploadResult =
  | {
      success: true
      data: {
        title: string
        fileName: string
        mimeType: string
        fileSize: number
      }
    }
  | { success: false; error: string }

export async function handleUpload(formData: FormData): Promise<UploadResult> {
  const audioFile = formData.get('audio')

  if (!audioFile || !(audioFile instanceof File)) {
    return { success: false, error: '오디오 파일이 필요합니다.' }
  }

  const validation = validateAudioFile(audioFile)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  const titleInput = formData.get('title')
  const title =
    typeof titleInput === 'string' && titleInput.trim().length > 0
      ? titleInput.trim()
      : audioFile.name.replace(/\.[^.]+$/, '')

  return {
    success: true,
    data: {
      title,
      fileName: audioFile.name,
      mimeType: audioFile.type,
      fileSize: audioFile.size,
    },
  }
}
