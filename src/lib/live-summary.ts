type LiveSummaryResult =
  | { success: true; markdown: string }
  | { success: false; error: string; rateLimited?: boolean }

interface LiveSummaryOptions {
  apiKey: string
  fetchFn?: typeof fetch
}

const LIVE_PROMPT = `회의가 아직 진행 중입니다. 지금까지의 발화 내용을 기반으로 짧고 구조화된 중간 요약을 작성하세요.

형식 (마크다운):
## 요약
(핵심 내용 3줄 이내)

## 주요 논의 사항
1. ...
2. ...

## 액션 아이템
- [ ] ...

규칙:
- 확정되지 않은 결정은 "(논의 중)"으로 표시
- 액션 아이템은 담당자/기한이 명확한 것만 포함
- 한국어로, 간결하게

---
음성 인식 텍스트:
`

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
        contents: [
          {
            parts: [{ text: `${LIVE_PROMPT}${trimmed}` }],
          },
        ],
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
