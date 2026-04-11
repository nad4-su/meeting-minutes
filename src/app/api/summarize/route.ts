import { NextRequest } from 'next/server'
import { generateGeminiMinutes, generateSimpleMinutes } from '@/lib/minutes-generator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, transcript, mode, date } = body

    if (!transcript || typeof transcript !== 'string') {
      return Response.json({ error: '변환할 텍스트가 필요합니다.' }, { status: 400 })
    }

    const input = {
      title: title || '무제 회의',
      transcript,
      date: date ? new Date(date) : new Date(),
    }

    if (mode === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY ?? ''
      const result = await generateGeminiMinutes(input, { apiKey })

      if (!result.success) {
        return Response.json({ error: result.error }, { status: 502 })
      }

      return Response.json({ markdown: result.markdown, mode: 'gemini' })
    }

    const markdown = generateSimpleMinutes(input)
    return Response.json({ markdown, mode: 'simple' })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json({ error: `요약 처리 실패: ${message}` }, { status: 500 })
  }
}
