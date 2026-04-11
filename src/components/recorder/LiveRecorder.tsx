'use client'

import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { formatTranscriptChunks } from '@/lib/transcript-formatter'

interface LiveRecorderProps {
  onTranscriptReady: (transcript: string) => void
}

export function LiveRecorder({ onTranscriptReady }: LiveRecorderProps) {
  const {
    isListening,
    isSupported,
    chunks,
    interimText,
    startListening,
    stopListening,
    resetChunks,
  } = useSpeechRecognition()

  if (!isSupported) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-amber-800">
          이 브라우저는 음성 인식을 지원하지 않습니다.
          Chrome 브라우저를 사용해주세요.
        </p>
      </div>
    )
  }

  function handleStop() {
    stopListening()
    const transcript = formatTranscriptChunks(chunks)
    if (transcript.length > 0) {
      onTranscriptReady(transcript)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {isListening ? (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 text-white font-medium shadow-lg shadow-red-500/25 hover:bg-red-600 transition-colors"
          >
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
            </span>
            녹음 중지
          </button>
        ) : (
          <button
            onClick={startListening}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-white font-medium shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors"
          >
            <span className="text-lg">🎤</span>
            녹음 시작
          </button>
        )}

        {chunks.length > 0 && !isListening && (
          <button
            onClick={resetChunks}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            초기화
          </button>
        )}
      </div>

      {(chunks.length > 0 || interimText) && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 max-h-64 overflow-y-auto">
          <h3 className="text-sm font-semibold text-neutral-500 mb-3 uppercase tracking-wider">
            실시간 텍스트
          </h3>
          <div className="space-y-1 text-sm font-mono text-neutral-700">
            {chunks.map((chunk, i) => (
              <p key={i}>{chunk.text}</p>
            ))}
            {interimText && (
              <p className="text-neutral-400 italic">{interimText}...</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
