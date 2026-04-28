import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { parseActionItems } from '@/lib/action-items'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * 마크다운에서 액션 아이템을 다시 추출하여 기존 항목을 모두 교체.
 * 사용자가 수동으로 트리거할 때만 호출됨 (PUT은 자동 재파싱하지 않음).
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { id: true, markdownMinutes: true },
    })

    if (!meeting) {
      return Response.json(
        { error: '회의록을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    const parsed = parseActionItems(meeting.markdownMinutes ?? '')

    await prisma.$transaction([
      prisma.actionItem.deleteMany({ where: { meetingId: id } }),
      prisma.actionItem.createMany({
        data: parsed.map((item, index) => ({
          meetingId: id,
          task: item.task,
          isDone: item.isDone,
          position: index,
        })),
      }),
    ])

    const items = await prisma.actionItem.findMany({
      where: { meetingId: id },
      orderBy: { position: 'asc' },
    })

    return Response.json({ actionItems: items, replaced: parsed.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `액션 아이템 재추출 실패: ${message}` },
      { status: 500 },
    )
  }
}
