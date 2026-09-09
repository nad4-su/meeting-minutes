/**
 * 녹음 조각을 디스크에 이어 붙이는 서버 저장소.
 *
 * 메모리에 모아 뒀다가 종료 시 한 번에 쓰지 않는다. 그러면 탭이나 서버가
 * 죽는 순간 회의 전체가 사라진다. 조각이 도착할 때마다 곧바로 append 하므로
 * 어느 시점에 중단되든 그때까지의 오디오는 파일로 남아 있다.
 *
 * MediaRecorder가 timeslice 모드에서 내보내는 조각은 첫 조각에 컨테이너
 * 헤더가 들어 있고 이후에는 클러스터만 이어진다. 받은 순서대로 이어 붙이면
 * 그대로 재생·전사 가능한 파일이 된다. 단 헤더의 duration 필드는 비어 있어
 * 플레이어에 따라 탐색(seek)이 부정확할 수 있다 — 재전사에는 영향이 없다.
 */

import { randomBytes } from 'crypto'
import { createReadStream } from 'fs'
import type { Readable } from 'stream'
import { appendFile, mkdir, readFile, stat, writeFile } from 'fs/promises'
import path from 'path'
import {
  MAX_RECORDING_BYTES,
  extensionForMimeType,
  isValidRecordingId,
} from './recording'

/** 별도 볼륨에 두고 싶으면 `RECORDINGS_DIR`로 덮어쓴다. */
export const RECORDINGS_DIR =
  process.env.RECORDINGS_DIR ?? path.join(process.cwd(), 'uploads', 'recordings')

export interface RecordingMeta {
  id: string
  mimeType: string
  /** `uploads/recordings/` 기준 상대 파일명. */
  fileName: string
  startedAt: string
  finalizedAt: string | null
  durationMs: number | null
}

export interface RecordingStatus extends RecordingMeta {
  bytes: number
}

/**
 * id별 직렬화 큐.
 *
 * 조각의 순서가 곧 파일의 순서다. 두 요청이 겹쳐 들어오면 컨테이너가
 * 깨지므로 같은 녹음에 대한 쓰기는 한 줄로 세운다.
 */
const queues = new Map<string, Promise<unknown>>()

function enqueue<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(id) ?? Promise.resolve()
  const next = previous.then(task, task)

  // 앞 작업이 실패해도 뒤 작업은 돌아야 하므로, 큐에는 절대 거부되지 않는
  // 프로미스를 넣는다. 실패는 호출자가 받는 `next`로만 전달된다.
  const settled = next.then(
    () => undefined,
    () => undefined,
  )

  // 큐가 무한정 자라지 않도록, 마지막 작업이 끝나면 항목을 지운다.
  queues.set(id, settled)
  settled.then(() => {
    if (queues.get(id) === settled) queues.delete(id)
  })

  return next
}

function metaPath(id: string): string {
  return path.join(RECORDINGS_DIR, `${id}.json`)
}

function audioPath(meta: RecordingMeta): string {
  return path.join(RECORDINGS_DIR, meta.fileName)
}

async function fileSize(filePath: string): Promise<number> {
  try {
    return (await stat(filePath)).size
  } catch {
    return 0
  }
}

/** 새 녹음 세션을 만든다. 오디오 파일은 첫 조각이 도착할 때 생긴다. */
export async function createRecording(
  mimeType: string,
): Promise<RecordingMeta> {
  const id = randomBytes(16).toString('hex')
  const meta: RecordingMeta = {
    id,
    mimeType,
    fileName: `${id}.${extensionForMimeType(mimeType)}`,
    startedAt: new Date().toISOString(),
    finalizedAt: null,
    durationMs: null,
  }

  await mkdir(RECORDINGS_DIR, { recursive: true })
  await writeFile(metaPath(id), JSON.stringify(meta, null, 2), 'utf-8')

  return meta
}

export async function getRecording(id: string): Promise<RecordingMeta | null> {
  if (!isValidRecordingId(id)) return null

  try {
    const raw = await readFile(metaPath(id), 'utf-8')
    return JSON.parse(raw) as RecordingMeta
  } catch {
    return null
  }
}

export async function getRecordingStatus(
  id: string,
): Promise<RecordingStatus | null> {
  const meta = await getRecording(id)
  if (!meta) return null

  return { ...meta, bytes: await fileSize(audioPath(meta)) }
}

export type AppendResult =
  | { ok: true; bytes: number }
  | { ok: false; error: string; status: number }

/** 조각 하나를 파일 끝에 이어 붙이고 누적 크기를 돌려준다. */
export async function appendChunk(
  id: string,
  chunk: Buffer,
): Promise<AppendResult> {
  const meta = await getRecording(id)
  if (!meta) {
    return { ok: false, error: '녹음 세션을 찾을 수 없습니다.', status: 404 }
  }

  return enqueue(id, async () => {
    const filePath = audioPath(meta)
    const current = await fileSize(filePath)

    if (current + chunk.byteLength > MAX_RECORDING_BYTES) {
      return {
        ok: false as const,
        error: `녹음이 상한(${Math.round(
          MAX_RECORDING_BYTES / 1024 / 1024,
        )}MB)을 넘었습니다.`,
        status: 413,
      }
    }

    await appendFile(filePath, chunk)
    return { ok: true as const, bytes: current + chunk.byteLength }
  })
}

/** 녹음을 닫는다. 이후 조각은 더 오지 않는다고 보고 길이를 확정한다. */
export async function finalizeRecording(
  id: string,
  durationMs: number | null,
): Promise<RecordingStatus | null> {
  const meta = await getRecording(id)
  if (!meta) return null

  return enqueue(id, async () => {
    const updated: RecordingMeta = {
      ...meta,
      finalizedAt: new Date().toISOString(),
      durationMs:
        typeof durationMs === 'number' && Number.isFinite(durationMs)
          ? Math.max(0, Math.round(durationMs))
          : null,
    }

    await writeFile(metaPath(id), JSON.stringify(updated, null, 2), 'utf-8')
    return { ...updated, bytes: await fileSize(audioPath(updated)) }
  })
}

/** 다운로드용 읽기 스트림. 파일이 없으면 null. */
export async function openRecording(
  id: string,
): Promise<{ meta: RecordingMeta; bytes: number; stream: Readable } | null> {
  const meta = await getRecording(id)
  if (!meta) return null

  const filePath = audioPath(meta)
  const bytes = await fileSize(filePath)
  if (bytes === 0) return null

  return { meta, bytes, stream: createReadStream(filePath) }
}
