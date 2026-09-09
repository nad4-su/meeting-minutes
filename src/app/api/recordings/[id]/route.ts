import { NextRequest } from 'next/server'
import { Readable } from 'stream'
import { finalizeRecording, getRecordingStatus, openRecording } from '@/lib/recording-store'
import { extensionForMimeType, isValidRecordingId } from '@/lib/recording'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/** 녹음 파일 내려받기. 헤더에는 사용자 입력을 넣지 않는다. */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  if (!isValidRecordingId(id)) {
    return Response.json({ error: '잘못된 녹음 세션 ID입니다.' }, { status: 400 })
  }

  const opened = await openRecording(id)
  if (!opened) {
    return Response.json({ error: '녹음을 찾을 수 없습니다.' }, { status: 404 })
  }

  const { meta, bytes, stream } = opened
  const stamp = meta.startedAt.slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
  const fileName = `meeting-${stamp}.${extensionForMimeType(meta.mimeType)}`

  return new Response(Readable.toWeb(stream as Readable) as ReadableStream, {
    headers: {
      'Content-Type': meta.mimeType,
      'Content-Length': String(bytes),
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** 녹음 종료. 길이를 확정하고 최종 상태를 돌려준다. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    if (!isValidRecordingId(id)) {
      return Response.json(
        { error: '잘못된 녹음 세션 ID입니다.' },
        { status: 400 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const durationMs =
      typeof body.durationMs === 'number' ? body.durationMs : null

    const status = await finalizeRecording(id, durationMs)
    if (!status) {
      return Response.json(
        { error: '녹음을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    return Response.json(status)
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `녹음 종료 처리 실패: ${message}` },
      { status: 500 },
    )
  }
}

/** 현재까지 저장된 크기 확인용. */
export async function HEAD(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  if (!isValidRecordingId(id)) return new Response(null, { status: 400 })

  const status = await getRecordingStatus(id)
  if (!status) return new Response(null, { status: 404 })

  return new Response(null, {
    status: 200,
    headers: { 'Content-Length': String(status.bytes) },
  })
}
