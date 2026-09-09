import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'

/**
 * jsdom에는 MediaRecorder도 getUserMedia도 없다. 훅이 다루는 것은
 * "조각이 언제 오고 어디로 가는가"이므로 그 둘만 흉내 내면 충분하다.
 */

class FakeMediaRecorder {
  static isTypeSupported = () => true

  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onerror: (() => void) | null = null
  private listeners: Record<string, Array<() => void>> = {}

  constructor(
    public stream: MediaStream,
    public options?: MediaRecorderOptions,
  ) {
    instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    // 실제 MediaRecorder는 stop() 시 남은 버퍼를 한 번 더 내보낸 뒤 stop을 쏜다.
    for (const fn of this.listeners.stop ?? []) fn()
  }

  addEventListener(type: string, fn: () => void) {
    ;(this.listeners[type] ??= []).push(fn)
  }

  emit(bytes: number) {
    this.ondataavailable?.({ data: new Blob([new Uint8Array(bytes)]) })
  }
}

let instances: FakeMediaRecorder[] = []
let stopTracks: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

beforeEach(() => {
  instances = []
  stopTracks = vi.fn()

  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [{ stop: stopTracks }],
      })),
    },
  })

  fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/recordings') {
      return jsonResponse({ id: 'a'.repeat(32), mimeType: 'audio/webm' }, true, 201)
    }
    if (url.endsWith('/chunk')) return jsonResponse({ bytes: 1024 })
    return jsonResponse({ bytes: 1024 })
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function startedHook() {
  const view = renderHook(() => useAudioRecorder())
  await waitFor(() => expect(view.result.current.isSupported).toBe(true))
  await act(async () => {
    await view.result.current.startRecording()
  })
  return view
}

describe('useAudioRecorder — 캡처 제약', () => {
  it('원거리 화자를 지우는 전처리를 끄고 마이크를 연다', async () => {
    await startedHook()

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: true,
      }),
    })
  })
})

describe('useAudioRecorder — 시간축', () => {
  it('캡처 시작 시각을 돌려준다', async () => {
    // 이 값을 인식기에 넘겨야 전사 타임스탬프가 오디오 파일과 같은 축을 쓴다.
    const before = Date.now()
    const view = renderHook(() => useAudioRecorder())
    await waitFor(() => expect(view.result.current.isSupported).toBe(true))

    let startedAt: number | null = null
    await act(async () => {
      startedAt = await view.result.current.startRecording()
    })

    expect(startedAt).not.toBeNull()
    expect(startedAt!).toBeGreaterThanOrEqual(before)
    expect(startedAt!).toBeLessThanOrEqual(Date.now())
  })

  it('마이크를 못 열면 null', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw Object.assign(new Error('denied'), { name: 'NotAllowedError' })
        }),
      },
    })

    const view = renderHook(() => useAudioRecorder())
    await waitFor(() => expect(view.result.current.isSupported).toBe(true))

    let startedAt: number | null = 0
    await act(async () => {
      startedAt = await view.result.current.startRecording()
    })

    expect(startedAt).toBeNull()
    expect(view.result.current.error).toContain('마이크 권한')
  })
})

describe('useAudioRecorder — 조각 업로드', () => {
  it('조각이 생길 때마다 서버로 올린다', async () => {
    const view = await startedHook()

    await act(async () => {
      instances[0].emit(2048)
    })

    await waitFor(() => {
      const chunkCalls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).endsWith('/chunk'),
      )
      expect(chunkCalls).toHaveLength(1)
    })

    expect(view.result.current.localBytes).toBe(2048)
  })

  it('빈 조각은 올리지 않는다', async () => {
    await startedHook()

    await act(async () => {
      instances[0].emit(0)
    })

    const chunkCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).endsWith('/chunk'),
    )
    expect(chunkCalls).toHaveLength(0)
  })

  it('업로드가 끝내 실패하면 뒤 조각을 이어 붙이지 않고 경고한다', async () => {
    // 중간이 빈 파일은 짧은 파일보다 나쁘다 — 재생도 전사도 안 된다.
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/recordings') {
        return jsonResponse({ id: 'a'.repeat(32) }, true, 201)
      }
      if (url.endsWith('/chunk')) return jsonResponse({ error: 'nope' }, false, 500)
      return jsonResponse({})
    })

    const view = await startedHook()

    await act(async () => {
      instances[0].emit(1024)
    })

    // 500은 일시 장애일 수 있으므로 백오프를 두고 3회까지 재시도한다.
    await waitFor(
      () => {
        expect(view.result.current.uploadWarning).toContain('서버 저장이 중단')
      },
      { timeout: 5_000 },
    )

    const callsAfterBreak = fetchMock.mock.calls.filter((c) =>
      String(c[0]).endsWith('/chunk'),
    ).length

    await act(async () => {
      instances[0].emit(1024)
    })

    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/chunk')).length,
    ).toBe(callsAfterBreak)
  })

  it('세션 생성이 실패해도 녹음은 계속된다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/recordings') {
        return jsonResponse({ error: 'down' }, false, 500)
      }
      return jsonResponse({})
    })

    const view = await startedHook()

    expect(view.result.current.isRecording).toBe(true)
    expect(view.result.current.uploadWarning).toContain('내려받아')

    await act(async () => {
      instances[0].emit(4096)
    })
    expect(view.result.current.localBytes).toBe(4096)
  })
})

describe('useAudioRecorder — 종료', () => {
  it('오디오를 한 조각도 못 받았으면 보관됐다고 말하지 않는다', async () => {
    const view = await startedHook()

    await act(async () => {
      await view.result.current.stopRecording()
    })

    expect(view.result.current.recording).toBeNull()
    expect(view.result.current.error).toContain('한 조각도 캡처되지 않았습니다')
    expect(view.result.current.isRecording).toBe(false)
  })

  it('받은 조각이 있으면 결과를 넘기고 마이크를 놓는다', async () => {
    const view = await startedHook()

    await act(async () => {
      instances[0].emit(1024)
    })
    await act(async () => {
      await view.result.current.stopRecording()
    })

    expect(view.result.current.recording?.blob.size).toBe(1024)
    expect(view.result.current.recording?.recordingId).toBe('a'.repeat(32))
    expect(stopTracks).toHaveBeenCalled()
    expect(view.result.current.isRecording).toBe(false)
  })

  it('서버 사본이 로컬보다 짧으면 경고한다', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/recordings') {
        return jsonResponse({ id: 'a'.repeat(32) }, true, 201)
      }
      if (url.endsWith('/chunk')) return jsonResponse({ bytes: 10 })
      return jsonResponse({ bytes: 10 })
    })

    const view = await startedHook()

    await act(async () => {
      instances[0].emit(4096)
    })
    await act(async () => {
      await view.result.current.stopRecording()
    })

    expect(view.result.current.uploadWarning).toContain('서버 사본이 로컬보다 짧습니다')
  })
})
