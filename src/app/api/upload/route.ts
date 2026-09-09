import { NextRequest } from 'next/server'
import { handleUpload } from '@/lib/upload-handler'
import {
  appendChunk,
  createRecording,
  finalizeRecording,
} from '@/lib/recording-store'

export const dynamic = 'force-dynamic'

/**
 * 오디오 파일 업로드.
 *
 * 예전에는 `uploads/`에 파일만 떨궈 두고 아무것도 하지 않는 막다른 길이었다.
 * 지금은 녹음 저장소에 그대로 넣어 `recordingId`를 돌려주므로, 브라우저 녹음과
 * 똑같이 `/api/transcribe`로 전사할 수 있다. 두 경로가 한 파이프라인으로 만난다.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const result = await handleUpload(formData)

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 })
    }

    const audioFile = formData.get('audio') as File
    const bytes = Buffer.from(await audioFile.arrayBuffer())

    const meta = await createRecording(result.data.mimeType)
    const appended = await appendChunk(meta.id, bytes)

    if (!appended.ok) {
      return Response.json({ error: appended.error }, { status: appended.status })
    }

    await finalizeRecording(meta.id, null)

    return Response.json({
      ...result.data,
      recordingId: meta.id,
      savedAs: meta.fileName,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json({ error: `업로드 처리 실패: ${message}` }, { status: 500 })
  }
}
