'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export function MeetingSearchBar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initial = searchParams.get('q') ?? ''
  const [q, setQ] = useState(initial)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const handle = setTimeout(() => {
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      if (q.trim()) {
        params.set('q', q.trim())
      } else {
        params.delete('q')
      }
      startTransition(() => {
        router.replace(
          params.toString() ? `${pathname}?${params.toString()}` : pathname,
          { scroll: false },
        )
      })
    }, 300)

    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  return (
    <div className="relative">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="제목 또는 내용 검색..."
        className="w-full rounded-xl border border-neutral-300 px-4 py-3 pr-10 text-neutral-800 placeholder:text-neutral-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 transition-all"
      />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
        {isPending ? (
          <span className="text-xs">검색 중...</span>
        ) : (
          <span>🔍</span>
        )}
      </div>
    </div>
  )
}
