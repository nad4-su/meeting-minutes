import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

type Store = typeof import('@/lib/recording-store')

let dir: string
let store: Store

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'recordings-'))
  process.env.RECORDINGS_DIR = dir
  vi.resetModules()
  store = await import('@/lib/recording-store')
})

afterEach(async () => {
  delete process.env.RECORDINGS_DIR
  await rm(dir, { recursive: true, force: true })
})

describe('createRecording', () => {
  it('세션 메타를 만들고 확장자를 붙인다', async () => {
    const meta = await store.createRecording('audio/webm;codecs=opus')

    expect(meta.id).toMatch(/^[0-9a-f]{32}$/)
    expect(meta.fileName).toBe(`${meta.id}.webm`)
    expect(meta.finalizedAt).toBeNull()
    expect(meta.durationMs).toBeNull()
  })

  it('매번 다른 id를 준다', async () => {
    const a = await store.createRecording('audio/webm')
    const b = await store.createRecording('audio/webm')
    expect(a.id).not.toBe(b.id)
  })
})

describe('appendChunk', () => {
  it('조각을 받은 순서대로 이어 붙인다', async () => {
    const { id } = await store.createRecording('audio/webm')

    await store.appendChunk(id, Buffer.from('AAA'))
    await store.appendChunk(id, Buffer.from('BBB'))
    const last = await store.appendChunk(id, Buffer.from('CC'))

    expect(last).toEqual({ ok: true, bytes: 8 })

    const meta = await store.getRecording(id)
    const written = await readFile(path.join(dir, meta!.fileName), 'utf-8')
    expect(written).toBe('AAABBBCC')
  })

  it('동시에 들어와도 순서가 섞이지 않는다', async () => {
    const { id } = await store.createRecording('audio/webm')

    // 클라이언트가 직렬로 보내도 서버에서 겹칠 수 있다. 겹쳐도 파일이
    // 깨지지 않아야 한다 — 순서가 어긋나면 컨테이너를 못 읽는다.
    await Promise.all([
      store.appendChunk(id, Buffer.from('1')),
      store.appendChunk(id, Buffer.from('2')),
      store.appendChunk(id, Buffer.from('3')),
      store.appendChunk(id, Buffer.from('4')),
    ])

    const meta = await store.getRecording(id)
    const written = await readFile(path.join(dir, meta!.fileName), 'utf-8')
    expect(written).toHaveLength(4)
    expect(written.split('').sort().join('')).toBe('1234')
  })

  it('없는 세션은 404로 거절한다', async () => {
    const result = await store.appendChunk('f'.repeat(32), Buffer.from('x'))
    expect(result).toEqual({
      ok: false,
      error: '녹음 세션을 찾을 수 없습니다.',
      status: 404,
    })
  })

  it('누적 크기를 정확히 보고한다', async () => {
    const { id } = await store.createRecording('audio/webm')
    await store.appendChunk(id, Buffer.from('keep'))

    const result = await store.appendChunk(id, Buffer.alloc(1024))
    expect(result).toEqual({ ok: true, bytes: 4 + 1024 })
  })
})

describe('finalizeRecording', () => {
  it('길이를 확정하고 최종 크기를 돌려준다', async () => {
    const { id } = await store.createRecording('audio/webm')
    await store.appendChunk(id, Buffer.from('0123456789'))

    const status = await store.finalizeRecording(id, 46_000)

    expect(status?.bytes).toBe(10)
    expect(status?.durationMs).toBe(46_000)
    expect(status?.finalizedAt).not.toBeNull()
  })

  it('확정 정보가 디스크에도 남는다', async () => {
    const { id } = await store.createRecording('audio/webm')
    await store.finalizeRecording(id, 1_234)

    const reloaded = await store.getRecording(id)
    expect(reloaded?.durationMs).toBe(1_234)
  })

  it('길이가 숫자가 아니면 null로 둔다', async () => {
    const { id } = await store.createRecording('audio/webm')
    const status = await store.finalizeRecording(id, null)
    expect(status?.durationMs).toBeNull()
  })

  it('없는 세션은 null', async () => {
    expect(await store.finalizeRecording('e'.repeat(32), 1)).toBeNull()
  })
})

describe('getRecording', () => {
  it('잘못된 id는 파일을 찾아보지도 않는다', async () => {
    expect(await store.getRecording('../../etc/passwd')).toBeNull()
    expect(await store.getRecording('..')).toBeNull()
  })
})

describe('openRecording', () => {
  it('조각이 하나도 없으면 null', async () => {
    const { id } = await store.createRecording('audio/webm')
    expect(await store.openRecording(id)).toBeNull()
  })

  it('저장된 바이트를 그대로 읽어준다', async () => {
    const { id } = await store.createRecording('audio/webm')
    await store.appendChunk(id, Buffer.from('hello'))

    const opened = await store.openRecording(id)
    expect(opened?.bytes).toBe(5)
    expect(opened?.meta.mimeType).toBe('audio/webm')

    const chunks: Buffer[] = []
    for await (const chunk of opened!.stream) {
      chunks.push(Buffer.from(chunk as Buffer))
    }
    expect(Buffer.concat(chunks).toString()).toBe('hello')
  })
})

describe('크래시 내성', () => {
  it('종료 처리 없이 중단돼도 그때까지의 오디오는 남는다', async () => {
    const { id } = await store.createRecording('audio/webm')
    await store.appendChunk(id, Buffer.from('part1'))
    await store.appendChunk(id, Buffer.from('part2'))
    // finalize 없이 프로세스가 죽었다고 치고 모듈을 새로 읽는다.
    vi.resetModules()
    const reloaded: Store = await import('@/lib/recording-store')

    const status = await reloaded.getRecordingStatus(id)
    expect(status?.bytes).toBe(10)
    expect(status?.finalizedAt).toBeNull()
  })
})
