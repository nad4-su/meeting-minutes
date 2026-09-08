import { NextRequest } from 'next/server'
import { clearSession, collectSamples, sessionSeconds } from '@/lib/audio-session'
import { diarize, modelsInstalled } from '@/lib/diarization'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ available: modelsInstalled() })
}

/**
 * 누적된 오디오 전체에 화자 분리를 돌린다.
 *
 * 창을 잘라 반복 실행하면 실행마다 화자 번호가 달라져 이어 붙일 수 없다.
 * 전역 클러스터링을 위해 녹음 종료 시 한 번만 돌린다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const sessionId = typeof body.session === 'string' ? body.session.trim() : ''

    if (!sessionId) {
      return Response.json({ error: 'session이 필요합니다.' }, { status: 400 })
    }

    const samples = collectSamples(sessionId)
    if (!samples) {
      return Response.json({ error: '누적된 오디오가 없습니다.' }, { status: 400 })
    }

    const numSpeakers =
      typeof body.numSpeakers === 'number' && body.numSpeakers > 1
        ? Math.floor(body.numSpeakers)
        : undefined

    const seconds = sessionSeconds(sessionId)
    const result = await diarize(samples, { numSpeakers })

    if (!result.success) {
      const status = result.reason === 'models-missing' ? 503 : 500
      return Response.json({ error: result.error, reason: result.reason }, { status })
    }

    clearSession(sessionId)

    return Response.json({
      segments: result.segments,
      seconds: Math.round(seconds),
      speakers: new Set(result.segments.map((s) => s.speaker)).size,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json({ error: `화자 분리 실패: ${message}` }, { status: 500 })
  }
}
