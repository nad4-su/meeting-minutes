'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimeSpan } from '@/lib/transcript-formatter'

export type DiarizationStatus =
  | { state: 'idle' }
  | { state: 'unavailable'; message: string }
  | { state: 'recording'; seconds: number }
  | { state: 'analyzing' }
  | { state: 'done'; speakers: number; segments: TimeSpan[] }
  | { state: 'error'; message: string }

interface UseDiarizationResult {
  /** 모델 설치 여부. null이면 확인 중. */
  available: boolean | null
  status: DiarizationStatus
  /** 오디오 수집 시작. 마이크 트랙을 넘긴다. */
  start: (track: MediaStreamTrack) => Promise<void>
  /** 수집을 멈추고 전체 오디오에 화자 분리를 돌린다. */
  finish: (numSpeakers?: number) => Promise<TimeSpan[]>
  reset: () => void
}

function newSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 대면 회의용 화자 분리.
 *
 * 녹음 중에는 4초짜리 PCM 조각을 서버에 쌓아두기만 하고, 녹음이 끝나면
 * 전체 오디오에 한 번 분리를 돌린다. 창을 잘라 반복 실행하면 실행마다
 * 화자 번호가 달라져 이어 붙일 수 없기 때문이다.
 */
export function useDiarization(): UseDiarizationResult {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [status, setStatus] = useState<DiarizationStatus>({ state: 'idle' })

  const sessionRef = useRef<string>('')
  const contextRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<AudioWorkletNode | null>(null)
  const secondsRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/diarize')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setAvailable(!!d.available)
      })
      .catch(() => {
        if (!cancelled) setAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const teardown = useCallback(() => {
    nodeRef.current?.port.close()
    nodeRef.current?.disconnect()
    nodeRef.current = null
    contextRef.current?.close().catch(() => {})
    contextRef.current = null
  }, [])

  const start = useCallback(
    async (track: MediaStreamTrack) => {
      sessionRef.current = newSessionId()
      secondsRef.current = 0

      try {
        // 16kHz로 열면 브라우저가 리샘플링해준다 — 모델이 받는 샘플레이트.
        const context = new AudioContext({ sampleRate: 16_000 })
        contextRef.current = context

        await context.audioWorklet.addModule('/pcm-worklet.js')

        const source = context.createMediaStreamSource(new MediaStream([track]))
        const node = new AudioWorkletNode(context, 'pcm-collector')
        nodeRef.current = node

        node.port.onmessage = (event) => {
          const pcm = event.data as Int16Array
          secondsRef.current += pcm.length / 16_000
          setStatus({
            state: 'recording',
            seconds: Math.round(secondsRef.current),
          })

          // 실패해도 녹음을 막지 않는다. 그 구간만 화자 분리에서 빠진다.
          fetch(`/api/diarize/chunk?session=${sessionRef.current}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            // 워크릿이 매번 새 버퍼를 transfer 하므로 buffer 전체가 곧 이 조각이다.
            body: pcm.buffer as ArrayBuffer,
          }).catch(() => {})
        }

        source.connect(node)
        setStatus({ state: 'recording', seconds: 0 })
      } catch (err) {
        teardown()
        setStatus({
          state: 'error',
          message:
            err instanceof Error
              ? `오디오 수집 실패: ${err.message}`
              : '오디오 수집에 실패했습니다.',
        })
      }
    },
    [teardown],
  )

  const finish = useCallback(
    async (numSpeakers?: number): Promise<TimeSpan[]> => {
      teardown()

      if (!sessionRef.current || secondsRef.current < 1) {
        setStatus({ state: 'idle' })
        return []
      }

      setStatus({ state: 'analyzing' })

      try {
        const res = await fetch('/api/diarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session: sessionRef.current, numSpeakers }),
        })
        const data = await res.json()

        if (!res.ok) {
          setStatus({
            state: 'error',
            message: data.error ?? '화자 분리에 실패했습니다.',
          })
          return []
        }

        const segments: TimeSpan[] = data.segments ?? []
        setStatus({ state: 'done', speakers: data.speakers ?? 0, segments })
        return segments
      } catch (err) {
        setStatus({
          state: 'error',
          message:
            err instanceof Error ? err.message : '화자 분리 요청에 실패했습니다.',
        })
        return []
      }
    },
    [teardown],
  )

  const reset = useCallback(() => {
    teardown()
    sessionRef.current = ''
    secondsRef.current = 0
    setStatus({ state: 'idle' })
  }, [teardown])

  useEffect(() => teardown, [teardown])

  return { available, status, start, finish, reset }
}
