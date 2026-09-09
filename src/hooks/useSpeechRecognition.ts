'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { TranscriptChunk } from '@/lib/transcript-formatter'

interface SpeechRecognitionHook {
  isListening: boolean
  isSupported: boolean | null
  chunks: TranscriptChunk[]
  interimText: string
  error: string | null
  /**
   * Chrome이 "소리는 들었는데 못 알아듣겠다"고 답한 횟수.
   *
   * `isFinal: true`에 `transcript: ""`인 결과다. 실측 46분 회의에서 19번 나왔다.
   * 조용히 버리면 유실이 보이지 않으므로 세어서 노출한다.
   */
  missedCount: number
  /**
   * @param timeOrigin 시간축의 기준점(ms). 오디오 녹음 시작 시각을 넘기면
   *   전사 타임스탬프가 녹음 파일의 재생 위치와 맞는다. 생략하면 지금 시각.
   */
  startListening: (timeOrigin?: number) => void
  /** 미확정 발화까지 확정한 최종 청크를 돌려준다. */
  stopListening: () => TranscriptChunk[]
  resetChunks: () => void
}

function describeError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '마이크 권한이 거부되었습니다. 브라우저 주소창 왼쪽 자물쇠 아이콘에서 마이크를 허용해주세요.'
    case 'audio-capture':
      return '마이크를 찾을 수 없습니다. 장치가 연결되어 있는지 확인해주세요.'
    case 'network':
      return '네트워크 오류로 음성 인식을 사용할 수 없습니다.'
    case 'language-not-supported':
      return '해당 언어가 지원되지 않습니다.'
    default:
      return `음성 인식 오류: ${code}`
  }
}

/** 발화 시작을 못 잡았을 때 되돌아갈 기본 길이(초). */
const FALLBACK_UTTERANCE_SECONDS = 2

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const [chunks, setChunks] = useState<TranscriptChunk[]>([])
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [missedCount, setMissedCount] = useState(0)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const startTimeRef = useRef<number>(0)
  const networkRetryRef = useRef<number>(0)

  // 청크의 정본은 ref다. 인식 종료 직후 곧바로 최종 결과를 넘겨야 하는데
  // setState는 비동기라 그 시점의 값을 읽을 수 없다.
  const chunksRef = useRef<TranscriptChunk[]>([])

  // 아직 확정되지 않은 발화. 세션이 끊기면 Chrome은 이걸 그냥 버리므로
  // 우리가 들고 있다가 직접 확정시킨다.
  const interimRef = useRef('')
  // 현재 발화가 처음 들리기 시작한 시각(초). interim이 처음 뜰 때 기록한다.
  const utteranceStartRef = useRef<number | null>(null)

  const MAX_NETWORK_RETRIES = 8

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
        ('SpeechRecognition' in window ||
          'webkitSpeechRecognition' in window),
    )
  }, [])

  const elapsed = useCallback(
    () => (Date.now() - startTimeRef.current) / 1000,
    [],
  )

  const appendChunk = useCallback((chunk: TranscriptChunk) => {
    chunksRef.current = [...chunksRef.current, chunk]
    setChunks(chunksRef.current)
  }, [])

  /**
   * 들고 있던 미확정 발화를 청크로 굳힌다.
   *
   * 세션이 끝날 때마다 호출한다. Chrome은 `continuous`여도 침묵마다 세션을
   * 닫는데, 그때 확정 전이던 문장이 통째로 사라지는 것이 유실의 큰 축이었다.
   */
  const flushInterim = useCallback(() => {
    const pending = interimRef.current.trim()
    interimRef.current = ''
    setInterimText('')

    if (pending.length === 0) {
      utteranceStartRef.current = null
      return
    }

    const end = elapsed()
    appendChunk({
      text: pending,
      startTime: utteranceStartRef.current ?? Math.max(0, end - FALLBACK_UTTERANCE_SECONDS),
      endTime: end,
      // Chrome이 확정해 준 결과가 아니라 우리가 살려낸 값이다.
      isFinal: false,
    })
    utteranceStartRef.current = null
  }, [appendChunk, elapsed])

  const startListening = useCallback((timeOrigin?: number) => {
    if (isSupported !== true) {
      setError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해주세요.')
      return
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'ko-KR'
    recognition.continuous = true
    recognition.interimResults = true

    startTimeRef.current = timeOrigin ?? Date.now()
    networkRetryRef.current = 0
    interimRef.current = ''
    utteranceStartRef.current = null
    setError(null)

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (networkRetryRef.current > 0) {
        networkRetryRef.current = 0
        setError(null)
      }

      const now = elapsed()

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript.trim()

        if (!result.isFinal) {
          // 발화의 첫 조각이 들린 순간이 곧 시작 시각이다.
          if (utteranceStartRef.current === null) {
            utteranceStartRef.current = now
          }
          interimRef.current = text
          setInterimText(text)
          continue
        }

        const start =
          utteranceStartRef.current ??
          Math.max(0, now - FALLBACK_UTTERANCE_SECONDS)

        interimRef.current = ''
        utteranceStartRef.current = null
        setInterimText('')

        if (text.length === 0) {
          // 소리는 감지했지만 인식에 실패한 구간. 프롬프트를 오염시키지 않도록
          // 청크로 넣지 않되, 유실이 있었다는 사실은 남긴다.
          setMissedCount((prev) => prev + 1)
          continue
        }

        appendChunk({ text, startTime: start, endTime: now, isFinal: true })
      }
    }

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return

      // 재시작 전에 반드시 비운다. 새 세션은 이전 오디오를 다시 주지 않는다.
      flushInterim()

      const delay = networkRetryRef.current > 0 ? 1500 : 0
      setTimeout(() => {
        if (recognitionRef.current !== recognition) return
        try {
          recognition.start()
        } catch {
          setIsListening(false)
          recognitionRef.current = null
          setError('음성 인식이 중단되었습니다. 다시 시작해주세요.')
        }
      }, delay)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return
      }

      if (event.error === 'network') {
        networkRetryRef.current += 1
        if (networkRetryRef.current > MAX_NETWORK_RETRIES) {
          setError(
            `네트워크 오류가 ${MAX_NETWORK_RETRIES}회 반복되어 녹음을 중단합니다. 지금까지의 텍스트는 보존되어 있습니다.`,
          )
          setIsListening(false)
          recognitionRef.current = null
          return
        }
        setError(
          `네트워크 일시 단절 — 자동 재연결 중 (${networkRetryRef.current}/${MAX_NETWORK_RETRIES})`,
        )
        return
      }

      setError(describeError(event.error))
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? `음성 인식을 시작할 수 없습니다: ${err.message}`
          : '음성 인식을 시작할 수 없습니다.',
      )
      recognitionRef.current = null
    }
  }, [appendChunk, elapsed, flushInterim, isSupported])

  const stopListening = useCallback((): TranscriptChunk[] => {
    const recognition = recognitionRef.current
    if (recognition) {
      recognitionRef.current = null
      recognition.stop()
      setIsListening(false)
    }

    // 마지막 발화는 확정 전에 세션이 닫히는 경우가 대부분이다.
    // 여기서 굳히지 않으면 회의 끝머리가 통째로 사라진다.
    flushInterim()

    return chunksRef.current
  }, [flushInterim])

  const resetChunks = useCallback(() => {
    chunksRef.current = []
    interimRef.current = ''
    utteranceStartRef.current = null
    setChunks([])
    setInterimText('')
    setError(null)
    setMissedCount(0)
  }, [])

  return {
    isListening,
    isSupported,
    chunks,
    interimText,
    error,
    missedCount,
    startListening,
    stopListening,
    resetChunks,
  }
}
