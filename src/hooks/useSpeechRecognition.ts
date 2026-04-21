'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { TranscriptChunk } from '@/lib/transcript-formatter'

interface SpeechRecognitionHook {
  isListening: boolean
  isSupported: boolean | null
  chunks: TranscriptChunk[]
  interimText: string
  error: string | null
  startListening: () => void
  stopListening: () => void
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

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const [chunks, setChunks] = useState<TranscriptChunk[]>([])
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const startTimeRef = useRef<number>(0)
  const networkRetryRef = useRef<number>(0)

  const MAX_NETWORK_RETRIES = 8

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
        ('SpeechRecognition' in window ||
          'webkitSpeechRecognition' in window),
    )
  }, [])

  const startListening = useCallback(() => {
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

    startTimeRef.current = Date.now()
    networkRetryRef.current = 0
    setError(null)

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (networkRetryRef.current > 0) {
        networkRetryRef.current = 0
        setError(null)
      }

      const now = (Date.now() - startTimeRef.current) / 1000

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript.trim()

        if (result.isFinal) {
          setChunks((prev) => [
            ...prev,
            {
              text,
              startTime: Math.max(0, now - 2),
              endTime: now,
              isFinal: true,
            },
          ])
          setInterimText('')
        } else {
          setInterimText(text)
        }
      }
    }

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return

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
  }, [isSupported])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      recognition.stop()
      setIsListening(false)
      setInterimText('')
    }
  }, [])

  const resetChunks = useCallback(() => {
    setChunks([])
    setInterimText('')
    setError(null)
  }, [])

  return {
    isListening,
    isSupported,
    chunks,
    interimText,
    error,
    startListening,
    stopListening,
    resetChunks,
  }
}
