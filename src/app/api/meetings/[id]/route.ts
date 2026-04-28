import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        actionItems: { orderBy: { position: 'asc' } },
      },
    })

    if (!meeting) {
      return Response.json(
        { error: '회의록을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    return Response.json(meeting)
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `회의록 조회 실패: ${message}` },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { title, markdownMinutes, attendees, tags } = body

    const data: Record<string, unknown> = {}
    if (typeof title === 'string' && title.trim().length > 0) {
      data.title = title.trim()
    }
    if (typeof markdownMinutes === 'string') {
      data.markdownMinutes = markdownMinutes
    }
    if (Array.isArray(attendees)) {
      data.attendees = attendees.filter((a) => typeof a === 'string')
    }
    if (Array.isArray(tags)) {
      data.tags = tags.filter((t) => typeof t === 'string')
    }

    if (Object.keys(data).length === 0) {
      return Response.json(
        { error: '수정할 내용이 없습니다.' },
        { status: 400 },
      )
    }

    try {
      const meeting = await prisma.meeting.update({
        where: { id },
        data,
      })
      return Response.json(meeting)
    } catch {
      return Response.json(
        { error: '회의록을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `회의록 수정 실패: ${message}` },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    try {
      await prisma.meeting.delete({ where: { id } })
      return new Response(null, { status: 204 })
    } catch {
      return Response.json(
        { error: '회의록을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `회의록 삭제 실패: ${message}` },
      { status: 500 },
    )
  }
}
