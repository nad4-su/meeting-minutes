export interface MinutesInput {
  title: string
  date: Date
  transcript: string
}

type GeminiResult =
  | { success: true; markdown: string }
  | { success: false; error: string }

interface GeminiOptions {
  apiKey: string
  fetchFn?: typeof fetch
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function generateSimpleMinutes(input: MinutesInput): string {
  const { title, date, transcript } = input
  const dateStr = formatDate(date)

  const content = transcript.trim().length > 0 ? transcript : '*내용 없음*'

  return `# ${title}

**날짜**: ${dateStr}

---

## 회의 내용

${content}

---

*이 회의록은 음성 인식 결과를 기반으로 자동 생성되었습니다.*
`
}

const GEMINI_PROMPT = `당신은 회의록 작성 전문가입니다. 아래 음성 인식 텍스트를 분석하여 구조화된 회의록을 마크다운 형식으로 작성해주세요.

포함할 섹션:
- ## 요약 (핵심 내용 3-5줄)
- ## 주요 논의 사항 (번호 매기기)
- ## 액션 아이템 (체크리스트 형식)
- ## 다음 단계

간결하고 명확하게 작성해주세요. 한국어로 작성합니다.

---
음성 인식 텍스트:
`

export async function generateGeminiMinutes(
  input: MinutesInput,
  options: GeminiOptions,
): Promise<GeminiResult> {
  const { apiKey, fetchFn = fetch } = options

  if (!apiKey || apiKey.trim().length === 0) {
    return { success: false, error: 'Gemini API 키가 필요합니다.' }
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
            parts: [{ text: `${GEMINI_PROMPT}${input.transcript}` }],
          },
        ],
      }),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Gemini API 호출 실패: ${response.status} ${response.statusText}`,
      }
    }

    const data = await response.json()
    const generatedText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    const dateStr = formatDate(input.date)
    const markdown = `# ${input.title}

**날짜**: ${dateStr}

---

${generatedText}

---

*이 회의록은 Gemini AI를 활용하여 자동 생성되었습니다.*
`

    return { success: true, markdown }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return {
      success: false,
      error: `Gemini API 호출 중 오류 발생: ${message}`,
    }
  }
}
