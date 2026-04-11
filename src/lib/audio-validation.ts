export const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/flac',
  'audio/x-m4a',
] as const

export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024 // 500MB

type ValidationResult =
  | { valid: true; error?: undefined }
  | { valid: false; error: string }

export function validateAudioFile(file: File): ValidationResult {
  if (file.size === 0) {
    return { valid: false, error: '파일이 비어 있습니다.' }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const maxMB = MAX_FILE_SIZE_BYTES / (1024 * 1024)
    return {
      valid: false,
      error: `파일 크기가 ${maxMB}MB를 초과합니다.`,
    }
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식입니다: ${file.type}`,
    }
  }

  return { valid: true }
}
