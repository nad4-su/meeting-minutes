/**
 * 녹음 중 들어오는 PCM 조각을 세션별로 모아 둔다.
 *
 * 화자 분리는 녹음이 끝난 뒤 전체 오디오에 한 번 돌린다. 누적분을 매번
 * 다시 보내면 1시간 회의에서 100MB가 넘는 요청이 되므로, 녹음 중에는
 * 몇 초짜리 조각만 올리고 서버가 이어 붙인다.
 *
 * 단일 사용자 로컬 실행을 전제로 한 메모리 저장소다. 여러 사용자가 붙는
 * 환경이라면 디스크나 외부 저장소로 옮겨야 한다.
 */

export const SAMPLE_RATE = 16_000

/** 세션당 최대 녹음 길이. 초과분은 거부한다. */
export const MAX_SESSION_SECONDS = 3 * 60 * 60

/** 마지막 갱신 이후 이 시간이 지난 세션은 정리한다. */
const SESSION_TTL_MS = 6 * 60 * 60 * 1000

interface Session {
  chunks: Int16Array[]
  totalSamples: number
  updatedAt: number
}

const sessions = new Map<string, Session>()

function sweep(): void {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const [id, session] of sessions) {
    if (session.updatedAt < cutoff) sessions.delete(id)
  }
}

export type AppendResult =
  | { ok: true; totalSamples: number; seconds: number }
  | { ok: false; error: string }

export function appendAudio(sessionId: string, pcm: Int16Array): AppendResult {
  sweep()

  const session = sessions.get(sessionId) ?? {
    chunks: [],
    totalSamples: 0,
    updatedAt: Date.now(),
  }

  const nextTotal = session.totalSamples + pcm.length
  if (nextTotal > MAX_SESSION_SECONDS * SAMPLE_RATE) {
    return {
      ok: false,
      error: `녹음이 최대 길이(${MAX_SESSION_SECONDS / 3600}시간)를 초과했습니다.`,
    }
  }

  session.chunks.push(pcm)
  session.totalSamples = nextTotal
  session.updatedAt = Date.now()
  sessions.set(sessionId, session)

  return {
    ok: true,
    totalSamples: nextTotal,
    seconds: nextTotal / SAMPLE_RATE,
  }
}

/** 누적된 PCM을 모델이 받는 [-1, 1] float32로 펼친다. */
export function collectSamples(sessionId: string): Float32Array | null {
  const session = sessions.get(sessionId)
  if (!session || session.totalSamples === 0) return null

  const out = new Float32Array(session.totalSamples)
  let offset = 0

  for (const chunk of session.chunks) {
    for (let i = 0; i < chunk.length; i++) {
      out[offset + i] = chunk[i] / 32768
    }
    offset += chunk.length
  }

  return out
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId)
}

export function sessionSeconds(sessionId: string): number {
  const session = sessions.get(sessionId)
  return session ? session.totalSamples / SAMPLE_RATE : 0
}
