/**
 * Gemini API 키 해석 우선순위:
 * 1) 요청 body로 전달된 키 (브라우저 LocalStorage에서 옴)
 * 2) process.env.GEMINI_API_KEY (서버 환경변수 fallback)
 * 3) null
 */
export function resolveGeminiApiKey(
  requestApiKey?: string | null | undefined,
): string | null {
  const fromRequest = typeof requestApiKey === 'string' ? requestApiKey.trim() : ''
  if (fromRequest.length > 0) return fromRequest

  const fromEnv = (process.env.GEMINI_API_KEY ?? '').trim()
  if (fromEnv.length > 0) return fromEnv

  return null
}

export function isEnvKeyConfigured(): boolean {
  return (process.env.GEMINI_API_KEY ?? '').trim().length > 0
}
