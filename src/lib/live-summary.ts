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
  /**
   * 직전 롤링 요약.
   *
   * 값이 있으면 증분 모드로 동작하며, 이때 `transcript` 인자는 전사 전체가 아니라
   * **직전 요약 이후 새로 추가된 발화**만 담아야 한다. 호출당 토큰이 회의 길이와
   * 무관하게 일정해진다.
   */
  previousSummary?: string
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

  const previous = options.previousSummary?.trim() ?? ''
  const incremental = previous.length > 0

  const templateId = options.template ?? 'meeting'
  const depth = resolveDepth(templateId, options.depth)
  const prompt = buildPrompt({
    templateId,
    depth,
    transcript: incremental
      ? `[지금까지의 요약]\n${previous}\n\n[새로 추가된 발화]\n${trimmed}`
      : trimmed,
    live: true,
    incremental,
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

export interface LiveSummaryPlan {
  /** 'full'이면 전사 전체를 보내고 previousSummary를 쓰지 않는다. */
  mode: 'full' | 'incremental'
  /** 이번에 보낼 청크의 시작 인덱스. full이면 0. */
  startIndex: number
}

export interface LiveSummaryPlanArgs {
  totalChunks: number
  lastSummarizedIndex: number
  incrementsSinceFull: number
  /** 0이면 주기적 전체 재요약을 하지 않는다. */
  fullRefreshEvery: number
  hasPreviousSummary: boolean
}

/**
 * 이번 롤링 요약 호출을 증분으로 보낼지 전체로 보낼지 결정한다.
 *
 * 증분 모드는 호출당 토큰을 회의 길이와 무관하게 유지하지만, 요약을 요약하는
 * 구조라 반복될수록 오차가 쌓인다. 그래서 일정 횟수마다 전사 전체로 한 번씩
 * 다시 요약해 오차를 끊는다.
 */
export function planLiveSummaryRequest(
  args: LiveSummaryPlanArgs,
): LiveSummaryPlan {
  const {
    totalChunks,
    lastSummarizedIndex,
    incrementsSinceFull,
    fullRefreshEvery,
    hasPreviousSummary,
  } = args

  // 전사가 초기화되어 인덱스가 범위를 벗어난 경우
  if (lastSummarizedIndex > totalChunks) {
    return { mode: 'full', startIndex: 0 }
  }

  // 첫 호출이거나 갱신할 요약이 아직 없는 경우
  if (lastSummarizedIndex === 0 || !hasPreviousSummary) {
    return { mode: 'full', startIndex: 0 }
  }

  if (fullRefreshEvery > 0 && incrementsSinceFull >= fullRefreshEvery) {
    return { mode: 'full', startIndex: 0 }
  }

  return { mode: 'incremental', startIndex: lastSummarizedIndex }
}
