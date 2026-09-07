import { NextRequest } from 'next/server'
import {
  generateAiMinutes,
  generateSimpleMinutes,
} from '@/lib/minutes-generator'
import { resolveProviderSettings } from '@/lib/api-keys'
import type { SummaryDepth, TemplateId } from '@/lib/templates'

const MAX_TRANSCRIPT_CHARS = 100_000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, transcript, mode, date, template, depth, customPrompt } = body

    if (!transcript || typeof transcript !== 'string') {
      return Response.json(
        { error: '변환할 텍스트가 필요합니다.' },
        { status: 400 },
      )
    }

    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return Response.json(
        {
          error: `텍스트가 너무 깁니다 (최대 ${MAX_TRANSCRIPT_CHARS.toLocaleString()}자).`,
        },
        { status: 413 },
      )
    }

    const input = {
      title: title || '무제 회의',
      transcript,
      date: date ? new Date(date) : new Date(),
      template: (template as TemplateId | undefined) ?? 'meeting',
      depth: depth as SummaryDepth | undefined,
      customPrompt:
        typeof customPrompt === 'string' ? customPrompt : undefined,
    }

    // 'gemini'는 DB에 저장된 기존 값과의 호환을 위해 유지되는 AI 모드 식별자다.
    if (mode === 'gemini' || mode === 'ai') {
      const settings = resolveProviderSettings(body)
      if (!settings) {
        const fallback = generateSimpleMinutes(input)
        return Response.json({
          markdown: fallback,
          mode: 'simple',
          warning:
            'AI 프로바이더가 설정되지 않아 단순 변환으로 대체되었습니다. /settings에서 설정하세요.',
        })
      }

      const result = await generateAiMinutes(input, { provider: settings })

      if (!result.success) {
        const fallback = generateSimpleMinutes(input)
        return Response.json({
          markdown: fallback,
          mode: 'simple',
          warning: `AI 요약에 실패하여 단순 변환으로 대체되었습니다: ${result.error}`,
        })
      }

      return Response.json({ markdown: result.markdown, mode: 'gemini' })
    }

    const markdown = generateSimpleMinutes(input)
    return Response.json({ markdown, mode: 'simple' })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `요약 처리 실패: ${message}` },
      { status: 500 },
    )
  }
}
