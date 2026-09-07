import {
  complete,
  describeModel,
  toProviderSettings,
  type ProviderSettings,
} from './providers'
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

type AiMinutesResult =
  | { success: true; markdown: string }
  | { success: false; error: string; rateLimited?: boolean }

interface AiMinutesOptions {
  /** 프로바이더 설정. 생략하면 apiKey로 Gemini를 호출한다. */
  provider?: ProviderSettings
  apiKey?: string
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

export async function generateAiMinutes(
  input: MinutesInput,
  options: AiMinutesOptions,
): Promise<AiMinutesResult> {
  const { fetchFn } = options
  const settings = toProviderSettings(options.provider, options.apiKey)

  const templateId = input.template ?? 'meeting'
  const depth = resolveDepth(templateId, input.depth)
  const prompt = buildPrompt({
    templateId,
    depth,
    transcript: input.transcript,
    live: false,
    customPrompt: input.customPrompt,
  })

  const result = await complete(prompt, settings, { fetchFn })

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      ...(result.rateLimited ? { rateLimited: true } : {}),
    }
  }

  const generatedText = result.text.trim()
  if (generatedText.length === 0) {
    return { success: false, error: '요약 결과가 비어 있습니다.' }
  }

  const dateStr = formatDate(input.date)
  const markdown = `# ${input.title}

**날짜**: ${dateStr}

---

${generatedText}

---

*이 회의록은 AI(${describeModel(settings)})를 활용하여 자동 생성되었습니다.*
`

  return { success: true, markdown }
}

/**
 * @deprecated `generateAiMinutes`를 사용하세요. Gemini 전용 호출부 하위 호환용입니다.
 */
export const generateGeminiMinutes = generateAiMinutes
