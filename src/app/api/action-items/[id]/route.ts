import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const { isDone, task } = body

    const data: Record<string, unknown> = {}
    if (typeof isDone === 'boolean') data.isDone = isDone
    if (typeof task === 'string' && task.trim().length > 0) {
      data.task = task.trim()
    }

    if (Object.keys(data).length === 0) {
      return Response.json(
        { error: '수정할 내용이 없습니다.' },
        { status: 400 },
      )
    }

    try {
      const item = await prisma.actionItem.update({
        where: { id },
        data,
      })
      return Response.json(item)
    } catch {
      return Response.json(
        { error: '액션 아이템을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `액션 아이템 수정 실패: ${message}` },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    try {
      await prisma.actionItem.delete({ where: { id } })
      return new Response(null, { status: 204 })
    } catch {
      return Response.json(
        { error: '액션 아이템을 찾을 수 없습니다.' },
        { status: 404 },
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `액션 아이템 삭제 실패: ${message}` },
      { status: 500 },
    )
  }
}
