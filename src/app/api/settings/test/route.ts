import { NextRequest } from 'next/server'
import { resolveProviderSettings } from '@/lib/api-keys'
import { complete, describeModel } from '@/lib/providers'

export const dynamic = 'force-dynamic'

const TEST_PROMPT = '"OK"라고만 한 단어로 답하세요.'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const settings = resolveProviderSettings(body)

    if (!settings) {
      return Response.json(
        {
          ok: false,
          error: '설정이 비어 있습니다. 키(또는 base URL과 모델)를 확인해주세요.',
        },
        { status: 400 },
      )
    }

    const result = await complete(TEST_PROMPT, settings)

    if (!result.success) {
      return Response.json(
        { ok: false, error: result.error },
        { status: 200 },
      )
    }

    return Response.json({
      ok: true,
      message: '설정이 정상적으로 동작합니다.',
      model: describeModel(settings),
      reply: result.text.trim().slice(0, 50),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { ok: false, error: `테스트 중 오류: ${message}` },
      { status: 500 },
    )
  }
}
