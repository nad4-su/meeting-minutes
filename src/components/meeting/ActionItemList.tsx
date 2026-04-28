'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export interface ActionItemView {
  id: string
  task: string
  isDone: boolean
}

interface ActionItemListProps {
  meetingId: string
  items: ActionItemView[]
}

export function ActionItemList({ meetingId, items }: ActionItemListProps) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const [reparsing, setReparsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const merged = items.map((item) => ({
    ...item,
    isDone: optimistic[item.id] ?? item.isDone,
  }))

  const total = merged.length
  const done = merged.filter((i) => i.isDone).length

  async function toggle(id: string, next: boolean) {
    setOptimistic((prev) => ({ ...prev, [id]: next }))
    setError(null)
    try {
      const res = await fetch(`/api/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone: next }),
      })
      if (!res.ok) {
        setOptimistic((prev) => {
          const copy = { ...prev }
          delete copy[id]
          return copy
        })
        const data = await res.json().catch(() => ({ error: '실패' }))
        setError(data.error ?? '토글 실패')
        return
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setOptimistic((prev) => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
      setError(err instanceof Error ? err.message : '토글 실패')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 액션 아이템을 삭제할까요?')) return
    try {
      const res = await fetch(`/api/action-items/${id}`, { method: 'DELETE' })
      if (res.ok || res.status === 204) {
        startTransition(() => router.refresh())
      }
    } catch {
      // ignore
    }
  }

  async function handleReparse() {
    if (
      total > 0 &&
      !confirm(
        '마크다운에서 액션 아이템을 다시 추출합니다. 현재 체크 상태가 모두 초기화됩니다. 계속할까요?',
      )
    ) {
      return
    }
    setReparsing(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/reparse-action-items`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '실패' }))
        setError(data.error ?? '재추출 실패')
        return
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : '재추출 실패')
    } finally {
      setReparsing(false)
    }
  }

  return (
    <section className="rounded-2xl border border-purple-200 bg-purple-50/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-purple-800">
          ✅ 액션 아이템
          {total > 0 && (
            <span className="rounded-full bg-purple-200 px-2 py-0.5 text-xs font-normal text-purple-800">
              {done}/{total}
            </span>
          )}
        </h2>
        <button
          onClick={handleReparse}
          disabled={reparsing}
          className="rounded-lg border border-purple-300 bg-white px-3 py-1 text-xs text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
          title="마크다운의 - [ ] 항목을 다시 읽어 액션 아이템을 갱신"
        >
          {reparsing ? '재추출 중...' : '🔄 재추출'}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {total === 0 ? (
        <p className="text-sm text-purple-600/70">
          마크다운에 <code className="text-xs">- [ ]</code> 형식 항목이 없습니다.
          본문에 추가한 뒤 <strong>🔄 재추출</strong> 버튼을 눌러주세요.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {merged.map((item) => (
            <li
              key={item.id}
              className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-white/60"
            >
              <input
                type="checkbox"
                checked={item.isDone}
                onChange={(e) => toggle(item.id, e.target.checked)}
                disabled={isPending}
                className="mt-1 h-4 w-4 cursor-pointer accent-purple-600"
              />
              <span
                className={`flex-1 text-sm ${
                  item.isDone
                    ? 'text-neutral-400 line-through'
                    : 'text-neutral-800'
                }`}
              >
                {item.task}
              </span>
              <button
                onClick={() => handleDelete(item.id)}
                className="invisible text-xs text-neutral-400 hover:text-red-600 group-hover:visible transition-colors"
                title="삭제"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
