export interface TranscriptChunk {
  text: string
  startTime: number
  endTime: number
  isFinal: boolean
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `[${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`
  }
  return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`
}

export function formatTranscriptChunks(chunks: readonly TranscriptChunk[]): string {
  if (chunks.length === 0) return ''

  return chunks
    .map((chunk) => `${formatTimestamp(chunk.startTime)} ${chunk.text}`)
    .join('\n')
}

export function mergeAdjacentChunks(
  chunks: readonly TranscriptChunk[],
  gapThreshold: number,
): TranscriptChunk[] {
  if (chunks.length === 0) return []

  const result: TranscriptChunk[] = [{ ...chunks[0] }]

  for (let i = 1; i < chunks.length; i++) {
    const current = chunks[i]
    const last = result[result.length - 1]

    if (current.startTime - last.endTime <= gapThreshold) {
      result[result.length - 1] = {
        text: `${last.text} ${current.text}`,
        startTime: last.startTime,
        endTime: current.endTime,
        isFinal: current.isFinal,
      }
    } else {
      result.push({ ...current })
    }
  }

  return result
}

/**
 * 서버 STT가 준 구간을 전사문으로 옮긴다.
 *
 * 여기 붙는 타임스탬프는 실제 오디오 타임라인이다. Web Speech 경로가 쓰던
 * `결과 이벤트 시각 − 2초` 추정값과 달리 화자 분리·구간 재생에 그대로 쓸 수 있다.
 */
export function formatTranscriptionSegments(
  segments: readonly { start: number; text: string }[],
): string {
  return segments
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => `${formatTimestamp(segment.start)} ${segment.text.trim()}`)
    .join('\n')
}

/** STT 구간을 기존 청크 구조로 변환한다 (화자 배정·병합 로직 재사용용). */
export function segmentsToChunks(
  segments: readonly { start: number; end: number; text: string }[],
): TranscriptChunk[] {
  return segments
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => ({
      text: segment.text.trim(),
      startTime: Math.max(0, segment.start),
      endTime: Math.max(segment.start, segment.end),
      isFinal: true,
    }))
}
