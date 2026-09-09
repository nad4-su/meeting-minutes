'use client'

import { useCallback, useState } from 'react'
import { getProviderRequestPayload } from '@/lib/api-key-storage'
import type { TranscriptionSegment } from '@/lib/providers/types'

export interface TranscriptionOutcome {
  transcript: string
  segments: TranscriptionSegment[]
  model: string
  hasTimestamps: boolean
}

export interface TranscriptionHook {
  isTranscribing: boolean
  error: string | null
  result: TranscriptionOutcome | null
  transcribeRecording: (
    recordingId: string,
    options?: { vocabularyHint?: string },
  ) => Promise<TranscriptionOutcome | null>
  reset: () => void
}

/**
 * 보관된 녹음을 서버 STT로 전사한다.
 *
 * Web Speech 결과를 덮어쓰는 것이 목적이다. 실시간 텍스트는 회의 중 흐름을
 * 보기 위한 초안이고, 확정본은 원본 오디오에서 다시 뽑는다.
 */
export function useTranscription(): TranscriptionHook {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TranscriptionOutcome | null>(null)

  const transcribeRecording = useCallback(
    async (recordingId: string, options: { vocabularyHint?: string } = {}) => {
      setIsTranscribing(true)
      setError(null)

      try {
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordingId,
            language: 'ko',
            vocabularyHint: options.vocabularyHint,
            ...getProviderRequestPayload(),
          }),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          setError(data.error ?? '전사에 실패했습니다.')
          return null
        }

        const outcome: TranscriptionOutcome = {
          transcript: data.transcript ?? '',
          segments: Array.isArray(data.segments) ? data.segments : [],
          model: data.model ?? '',
          hasTimestamps: Boolean(data.hasTimestamps),
        }
        setResult(outcome)
        return outcome
      } catch (err) {
        setError(
          err instanceof Error ? `전사 요청 실패: ${err.message}` : '전사 요청 실패',
        )
        return null
      } finally {
        setIsTranscribing(false)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { isTranscribing, error, result, transcribeRecording, reset }
}
