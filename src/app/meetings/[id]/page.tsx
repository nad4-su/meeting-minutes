import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { MeetingDetail } from '@/components/meeting/MeetingDetail'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const { id } = await params
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      actionItems: { orderBy: { position: 'asc' } },
    },
  })

  if (!meeting) {
    notFound()
  }

  return (
    <MeetingDetail
      meeting={{
        id: meeting.id,
        title: meeting.title,
        createdAt: meeting.createdAt.toISOString(),
        updatedAt: meeting.updatedAt.toISOString(),
        markdownMinutes: meeting.markdownMinutes,
        rawTranscript: meeting.rawTranscript,
        template: meeting.template,
        summaryMode: meeting.summaryMode,
        depth: meeting.depth,
        attendees: meeting.attendees,
        tags: meeting.tags,
        actionItems: meeting.actionItems.map((a) => ({
          id: a.id,
          task: a.task,
          isDone: a.isDone,
        })),
      }}
    />
  )
}
