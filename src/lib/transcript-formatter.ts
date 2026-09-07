import { resolveSpeakerName, type SpeakerNames } from './speakers'

export interface TranscriptChunk {
  text: string
  startTime: number
  endTime: number
  isFinal: boolean
  /** 화자 식별자. 단일 트랙 녹음에서는 없다. */
  speaker?: string
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

export function formatTranscriptChunks(
  chunks: readonly TranscriptChunk[],
  names?: SpeakerNames,
): string {
  if (chunks.length === 0) return ''

  return chunks
    .map((chunk) => {
      const stamp = formatTimestamp(chunk.startTime)
      if (!chunk.speaker) return `${stamp} ${chunk.text}`
      return `${stamp} ${resolveSpeakerName(chunk.speaker, names)}: ${chunk.text}`
    })
    .join('\n')
}

/**
 * 여러 트랙에서 나온 청크를 하나의 시간축으로 합친다.
 *
 * 각 인식기가 독립적으로 동작하므로 도착 순서가 발화 순서와 다를 수 있다.
 * 모든 트랙이 같은 timeOrigin을 공유한다는 전제 아래 startTime으로 정렬한다.
 */
export function mergeSpeakerChunks(
  ...streams: readonly (readonly TranscriptChunk[])[]
): TranscriptChunk[] {
  const merged = streams.flat()

  return merged
    .map((chunk, index) => ({ chunk, index }))
    .sort((a, b) => {
      const diff = a.chunk.startTime - b.chunk.startTime
      // 같은 시각이면 원래 순서를 유지해 결과가 흔들리지 않게 한다.
      return diff !== 0 ? diff : a.index - b.index
    })
    .map(({ chunk }) => chunk)
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

    // 화자가 다르면 붙이지 않는다 — 서로 다른 사람의 발화가 한 덩어리가 되면 안 된다.
    if (current.speaker !== last.speaker) {
      result.push({ ...current })
      continue
    }

    if (current.startTime - last.endTime <= gapThreshold) {
      result[result.length - 1] = {
        text: `${last.text} ${current.text}`,
        startTime: last.startTime,
        endTime: current.endTime,
        isFinal: current.isFinal,
        ...(last.speaker ? { speaker: last.speaker } : {}),
      }
    } else {
      result.push({ ...current })
    }
  }

  return result
}
