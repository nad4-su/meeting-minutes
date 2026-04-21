import Link from 'next/link'

export interface MeetingCardData {
  id: string
  title: string
  createdAt: string | Date
  template?: string | null
  summaryMode?: string | null
  tags?: string[]
  attendees?: string[]
  preview?: string
}

const TEMPLATE_LABELS: Record<string, { icon: string; name: string }> = {
  meeting: { icon: '🗂️', name: '회의록' },
  lecture: { icon: '🎓', name: '강의' },
  one_on_one: { icon: '🤝', name: '1:1' },
  brainstorm: { icon: '💡', name: '브레인' },
  interview: { icon: '🎤', name: '인터뷰' },
  raw: { icon: '📝', name: '원문' },
  custom: { icon: '⚙️', name: '커스텀' },
}

function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function MeetingCard({ meeting }: { meeting: MeetingCardData }) {
  const tpl = meeting.template
    ? TEMPLATE_LABELS[meeting.template]
    : undefined

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group block rounded-2xl border border-neutral-200 bg-white p-5 hover:border-purple-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-neutral-800 group-hover:text-purple-700 transition-colors line-clamp-2">
          {meeting.title}
        </h3>
        {tpl && (
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
            {tpl.icon} {tpl.name}
          </span>
        )}
      </div>

      <p className="text-xs text-neutral-500 mb-3">
        {formatDate(meeting.createdAt)}
      </p>

      {meeting.preview && (
        <p className="text-sm text-neutral-600 line-clamp-3 mb-3">
          {meeting.preview}
        </p>
      )}

      {(meeting.attendees?.length ?? 0) > 0 && (
        <p className="text-xs text-neutral-500 mb-2">
          👤 {meeting.attendees!.join(', ')}
        </p>
      )}

      {(meeting.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {meeting.tags!.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
