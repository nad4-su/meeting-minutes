'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TranscriptChunk } from '@/lib/transcript-formatter'
import { formatTranscriptChunks } from '@/lib/transcript-formatter'

interface UseLiveSummaryOptions {
  enabled: boolean
  pollIntervalMs?: number
  minWords?: number
  incrementWords?: number
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
  } = options

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

      const transcript = formatTranscriptChunks(chunksRef.current)
      const currentWordCount = countWords(transcript)

      if (currentWordCount < minWords) return
      if (currentWordCount - lastWordCountRef.current < incrementWords) return

      const controller = new AbortController()
      abortRef.current = controller
      inFlightRef.current = true
      setIsSummarizing(true)
      setError(null)

      try {
        const res = await fetch('/api/summarize-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
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
        setLastUpdatedAt(Date.now())
        lastWordCountRef.current = currentWordCount
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
  }, [enabled, pollIntervalMs, minWords, incrementWords])

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
