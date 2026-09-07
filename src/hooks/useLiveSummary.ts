'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TranscriptChunk } from '@/lib/transcript-formatter'
import { formatTranscriptChunks } from '@/lib/transcript-formatter'
import type { SummaryDepth, TemplateId } from '@/lib/templates'
import { getProviderRequestPayload } from '@/lib/api-key-storage'
import { planLiveSummaryRequest } from '@/lib/live-summary'

interface UseLiveSummaryOptions {
  enabled: boolean
  pollIntervalMs?: number
  minWords?: number
  incrementWords?: number
  /** 증분 요약을 이 횟수만큼 반복하면 전사 전체로 한 번 다시 요약한다. 0이면 끈다. */
  fullRefreshEvery?: number
  template?: TemplateId
  depth?: SummaryDepth
  customPrompt?: string
}

interface LiveSummaryState {
  summary: string
  isSummarizing: boolean
  error: string | null
  lastUpdatedAt: number | null
  wordCount: number
  wordsUntilNext: number
  minWords: number
  incrementWords: number
  cooldownUntil: number | null
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function useLiveSummary(
  chunks: readonly TranscriptChunk[],
  options: UseLiveSummaryOptions,
): LiveSummaryState {
  const {
    enabled,
    pollIntervalMs = 30_000,
    minWords = 25,
    incrementWords = 40,
    fullRefreshEvery = 20,
    template = 'meeting',
    depth,
    customPrompt,
  } = options

  const configRef = useRef({ template, depth, customPrompt })
  useEffect(() => {
    configRef.current = { template, depth, customPrompt }
  }, [template, depth, customPrompt])

  const [summary, setSummary] = useState('')
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)

  const chunksRef = useRef<readonly TranscriptChunk[]>(chunks)
  const lastWordCountRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const inFlightRef = useRef(false)
  const cooldownUntilRef = useRef<number | null>(null)
  const consecutiveFailuresRef = useRef(0)

  // 증분 요약 상태 — 성공했을 때만 전진시켜서 실패해도 발화를 잃지 않는다.
  const summaryRef = useRef('')
  const lastSummarizedIndexRef = useRef(0)
  const incrementsSinceFullRef = useRef(0)

  useEffect(() => {
    chunksRef.current = chunks
  }, [chunks])

  const wordCount = useMemo(
    () => countWords(formatTranscriptChunks(chunks)),
    [chunks],
  )

  const wordsUntilNext = useMemo(() => {
    if (lastUpdatedAt === null) {
      return Math.max(0, minWords - wordCount)
    }
    return Math.max(0, incrementWords - (wordCount - lastWordCountRef.current))
  }, [wordCount, lastUpdatedAt, minWords, incrementWords])

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort()
      abortRef.current = null
      inFlightRef.current = false
      return
    }

    async function maybeSummarize() {
      if (inFlightRef.current) return

      if (
        cooldownUntilRef.current !== null &&
        Date.now() < cooldownUntilRef.current
      ) {
        return
      }

      const allChunks = chunksRef.current
      const transcript = formatTranscriptChunks(allChunks)
      const currentWordCount = countWords(transcript)

      if (currentWordCount < minWords) return
      if (currentWordCount - lastWordCountRef.current < incrementWords) return

      const plan = planLiveSummaryRequest({
        totalChunks: allChunks.length,
        lastSummarizedIndex: lastSummarizedIndexRef.current,
        incrementsSinceFull: incrementsSinceFullRef.current,
        fullRefreshEvery,
        hasPreviousSummary: summaryRef.current.trim().length > 0,
      })

      // 요청을 보내는 시점의 길이를 고정해 둔다. 응답을 기다리는 동안
      // 새 청크가 쌓여도 그 부분은 다음 회차로 넘어간다.
      const chunkCountAtSend = allChunks.length
      const payloadTranscript =
        plan.mode === 'full'
          ? transcript
          : formatTranscriptChunks(allChunks.slice(plan.startIndex))

      if (payloadTranscript.trim().length === 0) return

      const controller = new AbortController()
      abortRef.current = controller
      inFlightRef.current = true
      setIsSummarizing(true)
      setError(null)

      try {
        const res = await fetch('/api/summarize-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: payloadTranscript,
            previousSummary:
              plan.mode === 'incremental' ? summaryRef.current : undefined,
            template: configRef.current.template,
            depth: configRef.current.depth,
            customPrompt: configRef.current.customPrompt,
            ...getProviderRequestPayload(),
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = await res
            .json()
            .catch(() => ({ error: '실시간 요약 실패' }))
          consecutiveFailuresRef.current += 1
          const backoffMs =
            res.status === 429
              ? 60_000
              : Math.min(120_000, 15_000 * consecutiveFailuresRef.current)
          const until = Date.now() + backoffMs
          cooldownUntilRef.current = until
          setCooldownUntil(until)
          setError(data.error ?? '실시간 요약 실패')
          return
        }

        const data = await res.json()
        setSummary(data.markdown)
        summaryRef.current = data.markdown
        setLastUpdatedAt(Date.now())
        lastWordCountRef.current = currentWordCount
        lastSummarizedIndexRef.current = chunkCountAtSend
        incrementsSinceFullRef.current =
          plan.mode === 'full' ? 0 : incrementsSinceFullRef.current + 1
        consecutiveFailuresRef.current = 0
        cooldownUntilRef.current = null
        setCooldownUntil(null)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
      } finally {
        inFlightRef.current = false
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        setIsSummarizing(false)
      }
    }

    const interval = setInterval(maybeSummarize, pollIntervalMs)

    return () => {
      clearInterval(interval)
    }
  }, [enabled, pollIntervalMs, minWords, incrementWords, fullRefreshEvery])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return {
    summary,
    isSummarizing,
    error,
    lastUpdatedAt,
    wordCount,
    wordsUntilNext,
    minWords,
    incrementWords,
    cooldownUntil,
  }
}
