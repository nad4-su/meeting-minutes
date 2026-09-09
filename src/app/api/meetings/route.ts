import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { parseActionItems } from '@/lib/action-items'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim() ?? ''
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT),
    )
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

    const where = q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { rawTranscript: { contains: q, mode: 'insensitive' as const } },
            { markdownMinutes: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          tags: true,
          attendees: true,
          template: true,
          summaryMode: true,
          status: true,
          _count: {
            select: { actionItems: { where: { isDone: false } } },
          },
        },
      }),
      prisma.meeting.count({ where }),
    ])

    return Response.json({
      meetings,
      total,
      limit,
      offset,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `회의록 목록 조회 실패: ${message}` },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      rawTranscript,
      markdownMinutes,
      summaryMode,
      template,
      depth,
      customPrompt,
      attendees,
      tags,
      audioFileName,
      audioMimeType,
      audioDuration,
    } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return Response.json(
        { error: '제목은 필수입니다.' },
        { status: 400 },
      )
    }

    if (!markdownMinutes || typeof markdownMinutes !== 'string') {
      return Response.json(
        { error: '회의록 본문은 필수입니다.' },
        { status: 400 },
      )
    }

    const parsed = parseActionItems(markdownMinutes)

    const meeting = await prisma.meeting.create({
      data: {
        title: title.trim(),
        rawTranscript: typeof rawTranscript === 'string' ? rawTranscript : null,
        markdownMinutes,
        summaryMode: typeof summaryMode === 'string' ? summaryMode : null,
        template: typeof template === 'string' ? template : null,
        depth: typeof depth === 'string' ? depth : null,
        customPrompt: typeof customPrompt === 'string' ? customPrompt : null,
        attendees: Array.isArray(attendees)
          ? attendees.filter((a) => typeof a === 'string')
          : [],
        tags: Array.isArray(tags)
          ? tags.filter((t) => typeof t === 'string')
          : [],
        audioFileName:
          typeof audioFileName === 'string' ? audioFileName : null,
        audioMimeType:
          typeof audioMimeType === 'string' ? audioMimeType : null,
        audioDuration:
          typeof audioDuration === 'number' && Number.isFinite(audioDuration)
            ? Math.max(0, Math.round(audioDuration))
            : null,
        status: 'COMPLETED',
        actionItems: {
          create: parsed.map((item, index) => ({
            task: item.task,
            isDone: item.isDone,
            position: index,
          })),
        },
      },
      include: { actionItems: true },
    })

    return Response.json(meeting, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json(
      { error: `회의록 생성 실패: ${message}` },
      { status: 500 },
    )
  }
}
