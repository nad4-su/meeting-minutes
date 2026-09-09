import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { resolveTranscriptionSettings } from '@/lib/api-keys'
import { resolveSttModel, transcribe } from '@/lib/providers'
import { getRecording, RECORDINGS_DIR } from '@/lib/recording-store'
import { isValidRecordingId } from '@/lib/recording'
import { formatTranscriptionSegments } from '@/lib/transcript-formatter'

export const dynamic = 'force-dynamic'

/** 어휘 힌트는 Whisper가 약 224토큰까지만 본다. 넘겨도 버려지므로 잘라 보낸다. */
const MAX_VOCABULARY_HINT_CHARS = 800

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { recordingId, language, vocabularyHint } = body

    if (!isValidRecordingId(recordingId)) {
      return Response.json(
        { error: '잘못된 녹음 세션 ID입니다.' },
        { status: 400 },
      )
    }

    const meta = await getRecording(recordingId)
    if (!meta) {
      return Response.json(
        { error: '녹음을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    const settings = resolveTranscriptionSettings(body)
    if (!settings) {
      return Response.json(
        {
          error:
            'AI 프로바이더가 설정되지 않았습니다. /settings에서 먼저 설정해주세요.',
        },
        { status: 400 },
      )
    }

    let bytes: Buffer
    try {
      bytes = await readFile(path.join(RECORDINGS_DIR, meta.fileName))
    } catch {
      return Response.json(
        { error: '녹음 파일을 읽을 수 없습니다. 오디오가 저장되지 않았을 수 있습니다.' },
        { status: 404 },
      )
    }

    if (bytes.byteLength === 0) {
      return Response.json(
        { error: '녹음 파일이 비어 있습니다.' },
        { status: 400 },
      )
    }

    const result = await transcribe(
      {
        bytes,
        mimeType: meta.mimeType,
        fileName: meta.fileName,
        language: typeof language === 'string' && language ? language : 'ko',
        vocabularyHint:
          typeof vocabularyHint === 'string' && vocabularyHint.trim().length > 0
            ? vocabularyHint.trim().slice(0, MAX_VOCABULARY_HINT_CHARS)
            : undefined,
      },
      settings,
    )

    if (!result.success) {
      return Response.json(
        { error: result.error },
        { status: result.rateLimited ? 429 : 502 },
      )
    }

    // 구간 타임스탬프가 있으면 `[MM:SS]` 형식으로 맞춘다. 없으면 원문 그대로.
    const transcript =
      result.segments.length > 0
        ? formatTranscriptionSegments(result.segments)
        : result.text

    return Response.json({
      transcript,
      text: result.text,
      segments: result.segments,
      model: result.model,
      hasTimestamps: result.segments.length > 0,
      audioBytes: bytes.byteLength,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json({ error: `전사 실패: ${message}` }, { status: 500 })
  }
}

/** 이 프로바이더 설정으로 전사가 가능한지 미리 확인. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const settings = resolveTranscriptionSettings({
    provider: url.searchParams.get('provider'),
    baseUrl: url.searchParams.get('baseUrl'),
    apiKey: url.searchParams.get('apiKey'),
  })

  return Response.json({
    configured: settings !== null,
    model: settings ? resolveSttModel(settings) : null,
  })
}
