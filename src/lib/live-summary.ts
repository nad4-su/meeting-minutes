import { complete, toProviderSettings, type ProviderSettings } from './providers'
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
  /** 프로바이더 설정. 생략하면 apiKey로 Gemini를 호출한다. */
  provider?: ProviderSettings
  apiKey?: string
  template?: TemplateId
  depth?: SummaryDepth
  customPrompt?: string
  fetchFn?: typeof fetch
}

export async function generateLiveSummary(
  transcript: string,
  options: LiveSummaryOptions,
): Promise<LiveSummaryResult> {
  const { fetchFn } = options
  const settings = toProviderSettings(options.provider, options.apiKey)

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

  const result = await complete(prompt, settings, { fetchFn })

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      ...(result.rateLimited ? { rateLimited: true } : {}),
    }
  }

  if (result.text.trim().length === 0) {
    return { success: false, error: '요약 결과가 비어 있습니다.' }
  }

  return { success: true, markdown: result.text }
}
