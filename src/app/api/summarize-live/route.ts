import { NextRequest } from 'next/server'
import { generateLiveSummary } from '@/lib/live-summary'
import type { SummaryDepth, TemplateId } from '@/lib/templates'

const MAX_TRANSCRIPT_CHARS = 40_000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transcript, template, depth, customPrompt } = body

    if (!transcript || typeof transcript !== 'string') {
      return Response.json(
        { error: '요약할 텍스트가 필요합니다.' },
        { status: 400 },
      )
    }

    const apiKey = process.env.GEMINI_API_KEY ?? ''
    if (!apiKey) {
      return Response.json(
        { error: 'Gemini API 키가 설정되지 않았습니다.' },
        { status: 503 },
      )
    }

    const truncated =
      transcript.length > MAX_TRANSCRIPT_CHARS
        ? transcript.slice(-MAX_TRANSCRIPT_CHARS)
        : transcript

    const result = await generateLiveSummary(truncated, {
      apiKey,
      template: (template as TemplateId | undefined) ?? 'meeting',
      depth: depth as SummaryDepth | undefined,
      customPrompt:
        typeof customPrompt === 'string' ? customPrompt : undefined,
    })

    if (!result.success) {
      const status = result.rateLimited ? 429 : 502
      return Response.json(
        { error: result.error, rateLimited: !!result.rateLimited },
        { status },
      )
    }

    return Response.json({ markdown: result.markdown })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `실시간 요약 실패: ${message}` },
      { status: 500 },
    )
  }
}
