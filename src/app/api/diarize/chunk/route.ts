import { NextRequest } from 'next/server'
import { appendAudio } from '@/lib/audio-session'

export const dynamic = 'force-dynamic'

/** 녹음 중 몇 초짜리 PCM 조각을 이어 붙인다. 본문은 16kHz 모노 Int16 raw PCM. */
export async function POST(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session')?.trim()
  if (!sessionId) {
    return Response.json({ error: 'session 파라미터가 필요합니다.' }, { status: 400 })
  }

  const buffer = await request.arrayBuffer()
  if (buffer.byteLength === 0) {
    return Response.json({ error: '오디오가 비어 있습니다.' }, { status: 400 })
  }
  if (buffer.byteLength % 2 !== 0) {
    return Response.json(
      { error: 'Int16 PCM이 아닙니다 (홀수 바이트).' },
      { status: 400 },
    )
  }

  const result = appendAudio(sessionId, new Int16Array(buffer))
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 413 })
  }

  return Response.json({ seconds: Math.round(result.seconds) })
}
