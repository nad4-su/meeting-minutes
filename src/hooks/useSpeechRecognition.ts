'use client'

import { useState, useRef, useCallback } from 'react'
import type { TranscriptChunk } from '@/lib/transcript-formatter'

interface SpeechRecognitionHook {
  isListening: boolean
  isSupported: boolean
  chunks: TranscriptChunk[]
  interimText: string
  startListening: () => void
  stopListening: () => void
  resetChunks: () => void
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const [chunks, setChunks] = useState<TranscriptChunk[]>([])
  const [interimText, setInterimText] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const startTimeRef = useRef<number>(0)

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const startListening = useCallback(() => {
    if (!isSupported) return

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'ko-KR'
    recognition.continuous = true
    recognition.interimResults = true

    startTimeRef.current = Date.now()

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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
      if (recognitionRef.current) {
        recognition.start()
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        recognitionRef.current = null
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
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
  }, [])

  return {
    isListening,
    isSupported,
    chunks,
    interimText,
    startListening,
    stopListening,
    resetChunks,
  }
}
