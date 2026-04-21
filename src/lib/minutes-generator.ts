import {
  buildPrompt,
  resolveDepth,
  type SummaryDepth,
  type TemplateId,
} from './templates'

export interface MinutesInput {
  title: string
  date: Date
  transcript: string
  template?: TemplateId
  depth?: SummaryDepth
  customPrompt?: string
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

export async function generateGeminiMinutes(
  input: MinutesInput,
  options: GeminiOptions,
): Promise<GeminiResult> {
  const { apiKey, fetchFn = fetch } = options

  if (!apiKey || apiKey.trim().length === 0) {
    return { success: false, error: 'Gemini API 키가 필요합니다.' }
  }

  const templateId = input.template ?? 'meeting'
  const depth = resolveDepth(templateId, input.depth)
  const prompt = buildPrompt({
    templateId,
    depth,
    transcript: input.transcript,
    live: false,
    customPrompt: input.customPrompt,
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
