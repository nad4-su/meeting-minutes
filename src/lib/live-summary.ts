import {
  buildPrompt,
  resolveDepth,
  type SummaryDepth,
  type TemplateId,
} from './templates'

type LiveSummaryResult =
  | { success: true; markdown: string }
  | { success: false; error: string; rateLimited?: boolean }

interface LiveSummaryOptions {
  apiKey: string
  template?: TemplateId
  depth?: SummaryDepth
  customPrompt?: string
  fetchFn?: typeof fetch
}

export async function generateLiveSummary(
  transcript: string,
  options: LiveSummaryOptions,
): Promise<LiveSummaryResult> {
  const { apiKey, fetchFn = fetch } = options

  if (!apiKey || apiKey.trim().length === 0) {
    return { success: false, error: 'Gemini API 키가 필요합니다.' }
  }

  const trimmed = transcript.trim()
  if (trimmed.length === 0) {
    return { success: false, error: '요약할 텍스트가 비어 있습니다.' }
  }

  const templateId = options.template ?? 'meeting'
  const depth = resolveDepth(templateId, options.depth)
  const prompt = buildPrompt({
    templateId,
    depth,
    transcript: trimmed,
    live: true,
    customPrompt: options.customPrompt,
  })

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'

  try {
    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: 'Gemini 요청 한도 초과. 잠시 후 자동 재시도됩니다.',
          rateLimited: true,
        }
      }
      return {
        success: false,
        error: `Gemini API 호출 실패: ${response.status}`,
      }
    }

    const data = await response.json()
    const markdown: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (markdown.trim().length === 0) {
      return { success: false, error: '요약 결과가 비어 있습니다.' }
    }

    return { success: true, markdown }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return { success: false, error: `실시간 요약 중 오류: ${message}` }
  }
}
