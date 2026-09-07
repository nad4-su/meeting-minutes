'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useDualStreamCapture } from '@/hooks/useDualStreamCapture'
import { useLiveSummary } from '@/hooks/useLiveSummary'
import {
  formatTranscriptChunks,
  mergeSpeakerChunks,
} from '@/lib/transcript-formatter'
import {
  LOCAL_SPEAKER,
  REMOTE_SPEAKER,
  resolveSpeakerName,
} from '@/lib/speakers'
import type { SummaryDepth, TemplateId } from '@/lib/templates'

interface LiveRecorderProps {
  onTranscriptReady: (transcript: string) => void
  liveSummaryEnabled: boolean
  template: TemplateId
  depth: SummaryDepth
  customPrompt?: string
}

export function LiveRecorder({
  onTranscriptReady,
  liveSummaryEnabled,
  template,
  depth,
  customPrompt,
}: LiveRecorderProps) {
  const [speakerSeparation, setSpeakerSeparation] = useState(false)
  const [pendingStart, setPendingStart] = useState(false)
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({})
  const timeOriginRef = useRef(0)

  const capture = useDualStreamCapture()

  // 화자 분리를 켜면 트랙마다 인식기를 붙인다. 트랙이 곧 화자가 되므로
  // 추론 없이 화자가 갈린다.
  // 두 트랙을 실제로 확보했을 때만 화자를 라벨링한다.
  // 마이크만 잡힌 상태에서 라벨을 붙이면 상대 발언이 내 것으로 기록된다.
  const isSeparating = capture.mode === 'dual-stream'

  const local = useSpeechRecognition({
    audioTrack: speakerSeparation ? capture.micTrack : null,
    speaker: isSeparating ? LOCAL_SPEAKER : undefined,
    timeOrigin: timeOriginRef.current || undefined,
  })

  const remote = useSpeechRecognition({
    audioTrack: capture.systemTrack,
    speaker: REMOTE_SPEAKER,
    timeOrigin: timeOriginRef.current || undefined,
  })

  const {
    isListening,
    isSupported,
    interimText,
    error: recognitionError,
    startListening,
  } = local

  const chunks = useMemo(
    () =>
      isSeparating
        ? mergeSpeakerChunks(local.chunks, remote.chunks)
        : local.chunks,
    [isSeparating, local.chunks, remote.chunks],
  )

  // 캡처가 끝나 트랙이 준비되면 그때 인식기를 시작한다.
  useEffect(() => {
    if (!pendingStart) return
    if (capture.mode === 'idle') return

    setPendingStart(false)
    local.startListening()
    if (capture.systemTrack) remote.startListening()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingStart, capture.mode, capture.systemTrack])

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
    timeOriginRef.current = Date.now()

    if (!speakerSeparation) {
      startListening()
      return
    }

    setPendingStart(true)
    await capture.start({ withSystemAudio: true })
  }

  function handleStop() {
    local.stopListening()
    remote.stopListening()
    capture.stop()

    const transcript = formatTranscriptChunks(chunks, speakerNames)
    if (transcript.length > 0) {
      onTranscriptReady(transcript)
    }
  }

  function handleReset() {
    local.resetChunks()
    remote.resetChunks()
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

        {chunks.length > 0 && !isListening && (
          <button
            onClick={handleReset}
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

        {isListening && capture.mode === 'dual-stream' && (
          <div className="flex items-center gap-1.5 rounded-full bg-purple-50 px-4 py-1.5 text-xs text-purple-700">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            화자 분리 중
          </div>
        )}
      </div>

      {!isListening && chunks.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={speakerSeparation}
              onChange={(e) => setSpeakerSeparation(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-purple-600"
            />
            <span>
              <span className="text-sm font-medium text-neutral-800">
                화자 분리 (원격 회의)
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                내 마이크와 상대 목소리를 별도 트랙으로 받아 구분합니다. 추론이 없어
                정확합니다. 시작 시 <strong>화면 공유 대화상자에서 &ldquo;탭 오디오 공유&rdquo;를
                반드시 켜주세요.</strong>
              </span>
              <span className="mt-1.5 block text-xs text-amber-700">
                한 대의 노트북을 앞에 두고 마주 앉은 <strong>대면 회의에서는 동작하지
                않습니다.</strong> 마이크 하나에 두 사람 목소리가 섞여 들어오기 때문입니다.
                이 경우 화자 라벨 없이 녹음되며, 대면 화자 분리는 준비 중입니다.
              </span>
            </span>
          </label>

          {speakerSeparation && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs text-neutral-500">내 이름</span>
                <input
                  type="text"
                  value={speakerNames[LOCAL_SPEAKER] ?? ''}
                  onChange={(e) =>
                    setSpeakerNames((prev) => ({
                      ...prev,
                      [LOCAL_SPEAKER]: e.target.value,
                    }))
                  }
                  placeholder="나"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-neutral-500">상대 이름</span>
                <input
                  type="text"
                  value={speakerNames[REMOTE_SPEAKER] ?? ''}
                  onChange={(e) =>
                    setSpeakerNames((prev) => ({
                      ...prev,
                      [REMOTE_SPEAKER]: e.target.value,
                    }))
                  }
                  placeholder="상대"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {capture.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>오디오 캡처 오류:</strong> {capture.error}
        </div>
      )}

      {capture.warning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ⚠️ {capture.warning}
        </div>
      )}

      {recognitionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>음성 인식 오류:</strong> {recognitionError}
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
                    <p key={i}>
                      {chunk.speaker && (
                        <span
                          className={`mr-1.5 font-semibold ${
                            chunk.speaker === LOCAL_SPEAKER
                              ? 'text-purple-600'
                              : 'text-teal-600'
                          }`}
                        >
                          {resolveSpeakerName(chunk.speaker, speakerNames)}:
                        </span>
                      )}
                      {chunk.text}
                    </p>
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
