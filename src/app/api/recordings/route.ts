import { NextRequest } from 'next/server'
import { createRecording } from '@/lib/recording-store'
import { PREFERRED_MIME_TYPES } from '@/lib/recording'

export const dynamic = 'force-dynamic'

/** 브라우저가 고른 mimeType만 허용한다. 임의 문자열이 확장자로 새어들면 안 된다. */
const ALLOWED_MIME_TYPES: readonly string[] = PREFERRED_MIME_TYPES

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { mimeType } = body

    if (typeof mimeType !== 'string' || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return Response.json(
        { error: '지원하지 않는 오디오 형식입니다.' },
        { status: 400 },
      )
    }

    const meta = await createRecording(mimeType)
    return Response.json(meta, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `녹음 세션 생성 실패: ${message}` },
      { status: 500 },
    )
  }
}
