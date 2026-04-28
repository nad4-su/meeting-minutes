import { NextRequest } from 'next/server'
import { resolveGeminiApiKey } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

const TEST_PROMPT = '"OK"라고만 한 단어로 답하세요.'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const apiKey = resolveGeminiApiKey(body.apiKey)

    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error: '키가 비어 있습니다.',
        },
        { status: 400 },
      )
    }

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: TEST_PROMPT }] }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const message =
        response.status === 400
          ? '잘못된 API 키 형식입니다.'
          : response.status === 403
            ? '권한이 거부되었습니다. 키를 확인해주세요.'
            : response.status === 429
              ? '요청 한도를 초과했지만 키 자체는 유효해 보입니다.'
              : `Gemini API 오류: ${response.status}`
      return Response.json(
        {
          ok: false,
          error: message,
          detail: errorText.slice(0, 200),
        },
        { status: 200 },
      )
    }

    const data = await response.json()
    const reply: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

    return Response.json({
      ok: true,
      message: '키가 정상적으로 동작합니다.',
      reply: reply.slice(0, 50),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { ok: false, error: `테스트 중 오류: ${message}` },
      { status: 500 },
    )
  }
}
