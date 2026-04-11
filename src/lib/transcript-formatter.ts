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
