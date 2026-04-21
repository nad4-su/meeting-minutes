import Link from 'next/link'
import { prisma } from '@/lib/db'
import { MeetingCard } from '@/components/meeting/MeetingCard'
import { MeetingSearchBar } from '@/components/meeting/MeetingSearchBar'
import { markdownToPlainText } from '@/lib/markdown'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; limit?: string; offset?: string }>
}

const DEFAULT_LIMIT = 20

export default async function MeetingsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const q = params.q?.trim() ?? ''
  const limit = Math.min(
    100,
    Math.max(1, Number(params.limit) || DEFAULT_LIMIT),
  )
  const offset = Math.max(0, Number(params.offset) || 0)

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
        template: true,
        summaryMode: true,
        tags: true,
        attendees: true,
        markdownMinutes: true,
      },
    }),
    prisma.meeting.count({ where }),
  ])

  const cards = meetings.map((m) => ({
    id: m.id,
    title: m.title,
    createdAt: m.createdAt,
    template: m.template,
    summaryMode: m.summaryMode,
    tags: m.tags,
    attendees: m.attendees,
    preview: m.markdownMinutes
      ? markdownToPlainText(m.markdownMinutes, 140)
      : undefined,
  }))

  return (
    <main className="flex-1 bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
              저장된 회의록
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              총 {total}건
              {q && (
                <>
                  {' '}
                  · <span className="text-neutral-700">&quot;{q}&quot;</span> 검색
                </>
              )}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            + 새 회의 녹음
          </Link>
        </header>

        <section className="mb-6">
          <MeetingSearchBar />
        </section>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-16 text-center">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-neutral-700 font-medium">
              {q ? '검색 결과가 없습니다.' : '아직 저장된 회의록이 없습니다.'}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              {q
                ? '다른 키워드로 검색해보세요.'
                : '첫 회의를 녹음하고 "📌 저장" 버튼으로 이곳에 추가하세요.'}
            </p>
            {!q && (
              <Link
                href="/"
                className="mt-6 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
              >
                녹음 시작하기 →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cards.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        )}

        {total > limit && (
          <nav className="mt-8 flex items-center justify-between text-sm">
            {offset > 0 ? (
              <Link
                href={`/meetings?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  offset: String(Math.max(0, offset - limit)),
                }).toString()}`}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 transition-colors"
              >
                ← 이전
              </Link>
            ) : (
              <span />
            )}
            <span className="text-neutral-500">
              {offset + 1}-{Math.min(offset + limit, total)} / {total}
            </span>
            {offset + limit < total ? (
              <Link
                href={`/meetings?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  offset: String(offset + limit),
                }).toString()}`}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 transition-colors"
              >
                다음 →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </main>
  )
}
