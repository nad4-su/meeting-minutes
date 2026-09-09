import { NextRequest } from 'next/server'
import { appendChunk } from '@/lib/recording-store'
import { MAX_CHUNK_BYTES, isValidRecordingId } from '@/lib/recording'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * 녹음 조각 하나를 이어 붙인다.
 *
 * 본문은 MediaRecorder가 준 바이트 그대로다. JSON이나 multipart로 감싸면
 * base64 팽창이나 파싱 비용만 늘어난다.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    if (!isValidRecordingId(id)) {
      return Response.json(
        { error: '잘못된 녹음 세션 ID입니다.' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await request.arrayBuffer())

    if (buffer.byteLength === 0) {
      return Response.json({ error: '빈 조각입니다.' }, { status: 400 })
    }

    if (buffer.byteLength > MAX_CHUNK_BYTES) {
      return Response.json(
        { error: '조각이 너무 큽니다.' },
        { status: 413 },
      )
    }

    const result = await appendChunk(id, buffer)

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status })
    }

    return Response.json({ bytes: result.bytes })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `녹음 조각 저장 실패: ${message}` },
      { status: 500 },
    )
  }
}
