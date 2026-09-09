'use client'

import { useEffect, useRef } from 'react'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useLiveSummary } from '@/hooks/useLiveSummary'
import { useAudioRecorder, type CompletedRecording } from '@/hooks/useAudioRecorder'
import { formatTranscriptChunks } from '@/lib/transcript-formatter'
import { formatBytes, formatDuration } from '@/lib/recording'
import type { SummaryDepth, TemplateId } from '@/lib/templates'

interface LiveRecorderProps {
  onTranscriptReady: (transcript: string) => void
  onRecordingReady?: (recording: CompletedRecording) => void
  title: string
  liveSummaryEnabled: boolean
  template: TemplateId
  depth: SummaryDepth
  customPrompt?: string
}

export function LiveRecorder({
  onTranscriptReady,
  onRecordingReady,
  title,
  liveSummaryEnabled,
  template,
  depth,
  customPrompt,
}: LiveRecorderProps) {
  const {
    isListening,
    isSupported,
    chunks,
    interimText,
    error: recognitionError,
    startListening,
    stopListening,
    resetChunks,
  } = useSpeechRecognition()

  const {
    isRecording,
    isSupported: isRecordingSupported,
    error: recordingError,
    uploadWarning,
    elapsedMs,
    localBytes,
    uploadedBytes,
    recording,
    startRecording,
    stopRecording,
    downloadRecording,
    reset: resetRecording,
  } = useAudioRecorder()

  const {
    summary,
    isSummarizing,
    error: summaryError,
    lastUpdatedAt,
    wordCount,
    wordsUntilNext,
    minWords,
    cooldownUntil,
  } = useLiveSummary(chunks, {
    enabled: liveSummaryEnabled && isListening,
    template,
    depth,
    customPrompt,
  })

  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const summaryEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chunks.length, interimText])

  useEffect(() => {
    summaryEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [summary])

  // 녹음이 끝나 파일이 확정되면 상위로 올려 회의록과 함께 저장되게 한다.
  useEffect(() => {
    if (recording) onRecordingReady?.(recording)
  }, [recording, onRecordingReady])

  if (isSupported === null) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400">
        브라우저 기능 확인 중...
      </div>
    )
  }

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

  async function handleStart() {
    resetRecording()
    // 오디오 녹음을 먼저 건다. 전사가 실패하더라도 원본은 남아야 한다.
    await startRecording()
    startListening()
  }

  async function handleStop() {
    stopListening()

    const transcript = formatTranscriptChunks(chunks)
    if (transcript.length > 0) {
      onTranscriptReady(transcript)
    }

    await stopRecording()
  }

  const lastUpdatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  const hasTranscript = chunks.length > 0 || interimText.length > 0
  const hasSummary = summary.length > 0
  const showPanels = isListening || hasTranscript || hasSummary

  const cooldownSeconds =
    cooldownUntil && cooldownUntil > Date.now()
      ? Math.ceil((cooldownUntil - Date.now()) / 1000)
      : 0

  const summaryProgress = (() => {
    if (!liveSummaryEnabled) return null
    if (!isListening && !hasSummary) return null
    if (cooldownSeconds > 0) return `⏸️ API 쿼터 초과 — ${cooldownSeconds}초 후 재시도`
    if (isSummarizing) return '요약 생성 중...'
    if (!hasSummary) {
      if (wordCount < minWords) {
        return `첫 요약까지 ${wordsUntilNext}단어 (${wordCount}/${minWords})`
      }
      return '곧 첫 요약이 생성됩니다...'
    }
    if (wordsUntilNext > 0 && isListening) {
      return `다음 갱신까지 ${wordsUntilNext}단어`
    }
    return isListening ? '다음 갱신 대기 중...' : '녹음 종료됨'
  })()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
            onClick={handleStart}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-white font-medium shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors"
          >
            <span className="text-lg">🎤</span>
            녹음 시작
          </button>
        )}

        {recording && !isListening && (
          <button
            onClick={() => downloadRecording(title)}
            className="flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            ⬇️ 오디오 내려받기 ({formatBytes(recording.blob.size)})
          </button>
        )}

        {chunks.length > 0 && !isListening && (
          <button
            onClick={() => {
              resetChunks()
              resetRecording()
            }}
            className="rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            초기화
          </button>
        )}

        {isListening && (
          <div className="flex items-center gap-2 rounded-full bg-red-50 px-4 py-1.5 text-xs text-red-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            녹음 중 · {wordCount}단어 · {chunks.length}개 구간
          </div>
        )}

        {isRecording && (
          <div className="flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-1.5 text-xs text-neutral-600">
            <span className="text-sm">🎧</span>
            오디오 {formatDuration(elapsedMs)} · 저장 {formatBytes(uploadedBytes)}
            {localBytes > 0 && uploadedBytes < localBytes && (
              <span className="text-amber-600">
                (전송 대기 {formatBytes(localBytes - uploadedBytes)})
              </span>
            )}
          </div>
        )}
      </div>

      {isRecordingSupported === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          이 브라우저는 오디오 녹음을 지원하지 않습니다. 전사만 진행되며,
          <strong> 놓친 발화를 나중에 복구할 수 없습니다.</strong> Chrome을 사용해주세요.
        </div>
      )}

      {recordingError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>오디오 녹음 오류:</strong> {recordingError}
        </div>
      )}

      {uploadWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>⚠️ 서버 저장 문제:</strong> {uploadWarning}
        </div>
      )}

      {recognitionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>음성 인식 오류:</strong> {recognitionError}
        </div>
      )}

      {recording && !isListening && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <strong>
            🎧 오디오 {formatDuration(recording.durationMs)} ·{' '}
            {formatBytes(recording.blob.size)} 확보
          </strong>
          {' — '}
          {recording.recordingId
            ? `서버에 ${formatBytes(recording.uploadedBytes)} 저장됨.`
            : '서버 저장 실패 — 브라우저 사본만 있습니다.'}{' '}
          전사가 놓친 발화는 이 오디오로 다시 살릴 수 있습니다.
          {!recording.recordingId && (
            <strong> 지금 내려받아 보관해주세요.</strong>
          )}
        </div>
      )}

      {isListening && !hasTranscript && (
        <div className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 p-6 text-center">
          <p className="text-sm text-blue-700">
            🎙️ 마이크가 활성화되었습니다. 말씀해주세요...
          </p>
          <p className="mt-1 text-xs text-blue-500">
            아무 반응이 없다면 브라우저 주소창 왼쪽에서 마이크 권한을 확인해주세요.
          </p>
        </div>
      )}

      {showPanels && (
        <div
          className={`grid gap-4 ${
            liveSummaryEnabled ? 'lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          <section className="flex flex-col rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden">
            <header className="flex items-center justify-between border-b border-neutral-200 bg-white/60 px-5 py-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isListening ? 'bg-red-500 animate-pulse' : 'bg-neutral-300'
                  }`}
                />
                <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                  실시간 텍스트
                </h3>
              </div>
              <span className="text-xs text-neutral-500">
                {chunks.length}개 구간 · {wordCount}단어
              </span>
            </header>
            <div className="h-80 overflow-y-auto px-5 py-4">
              {hasTranscript ? (
                <div className="space-y-1 text-sm font-mono leading-relaxed text-neutral-700">
                  {chunks.map((chunk, i) => (
                    <p key={i}>{chunk.text}</p>
                  ))}
                  {interimText && (
                    <p className="text-neutral-400 italic">
                      {interimText}
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-neutral-400 align-middle" />
                    </p>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              ) : (
                <p className="text-sm text-neutral-400">
                  {isListening
                    ? '발화를 기다리는 중...'
                    : '녹음을 시작하면 여기에 텍스트가 나타납니다.'}
                </p>
              )}
            </div>
          </section>

          {liveSummaryEnabled && (
            <section className="flex flex-col rounded-2xl border border-purple-200 bg-purple-50/50 overflow-hidden">
              <header className="flex items-center justify-between border-b border-purple-200 bg-white/60 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isSummarizing
                        ? 'bg-purple-500 animate-pulse'
                        : hasSummary
                        ? 'bg-purple-400'
                        : 'bg-purple-200'
                    }`}
                  />
                  <h3 className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
                    실시간 회의록
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-purple-500">
                  {summaryProgress && <span>{summaryProgress}</span>}
                  {lastUpdatedLabel && <span>· {lastUpdatedLabel}</span>}
                </div>
              </header>
              <div className="h-80 overflow-y-auto px-5 py-4">
                {summaryError ? (
                  <p className="text-sm text-red-600">{summaryError}</p>
                ) : hasSummary ? (
                  <>
                    <pre className="whitespace-pre-wrap text-sm text-neutral-700 font-mono leading-relaxed">
                      {summary}
                    </pre>
                    <div ref={summaryEndRef} />
                  </>
                ) : (
                  <div className="flex flex-col gap-3 text-sm text-purple-600">
                    <p>
                      발화가 쌓이면 30초 간격으로 Gemini가 중간 회의록을
                      작성합니다.
                    </p>
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs text-purple-500">
                        <span>진행률</span>
                        <span>
                          {Math.min(wordCount, minWords)}/{minWords}단어
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-purple-100">
                        <div
                          className="h-full bg-purple-400 transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              (wordCount / minWords) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
