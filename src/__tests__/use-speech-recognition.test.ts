import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'

/**
 * jsdom에는 SpeechRecognition이 없다. 여기서 검증하려는 것은 인식 품질이 아니라
 * **Chrome이 준 것을 우리가 흘리지 않는가**이므로, 이벤트를 직접 쏠 수 있는
 * 최소 구현이면 충분하다.
 */

interface FakeResult {
  isFinal: boolean
  0: { transcript: string }
}

class FakeSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false

  onresult: ((event: { resultIndex: number; results: FakeResult[] }) => void) | null = null
  onend: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null

  started = 0

  constructor() {
    instances.push(this)
  }

  start() {
    this.started += 1
  }

  stop() {
    // 실제 Chrome은 stop() 뒤에도 onend를 쏘지만, 훅이 ref를 먼저 끊어
    // 재시작을 막는다. 그 동작을 그대로 흉내 낸다.
    this.onend?.()
  }

  /** Chrome이 결과를 내보내는 것을 흉내 낸다. */
  emit(...results: Array<{ text: string; final: boolean }>) {
    this.onresult?.({
      resultIndex: 0,
      results: results.map((r) => ({
        isFinal: r.final,
        0: { transcript: r.text },
      })),
    })
  }
}

let instances: FakeSpeechRecognition[] = []

beforeEach(() => {
  instances = []
  vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition)
  vi.stubGlobal('webkitSpeechRecognition', FakeSpeechRecognition)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function listening(timeOrigin?: number) {
  const view = renderHook(() => useSpeechRecognition())
  await waitFor(() => expect(view.result.current.isSupported).toBe(true))
  act(() => view.result.current.startListening(timeOrigin))
  return view
}

describe('확정된 발화', () => {
  it('청크로 쌓인다', async () => {
    const view = await listening()

    act(() => instances[0].emit({ text: '안녕하세요', final: true }))

    expect(view.result.current.chunks).toHaveLength(1)
    expect(view.result.current.chunks[0].text).toBe('안녕하세요')
    expect(view.result.current.chunks[0].isFinal).toBe(true)
  })

  it('빈 확정 결과는 청크로 넣지 않고 유실로 센다', async () => {
    // 실측 46분 회의에서 19번 나온 케이스. Chrome이 "소리는 들었는데
    // 못 알아듣겠다"고 답한 것으로, 청크로 넣으면 요약 프롬프트가 오염된다.
    const view = await listening()

    act(() => instances[0].emit({ text: '   ', final: true }))
    act(() => instances[0].emit({ text: '', final: true }))

    expect(view.result.current.chunks).toHaveLength(0)
    expect(view.result.current.missedCount).toBe(2)
  })
})

describe('미확정 발화 보존', () => {
  it('세션이 끊길 때 확정 전 발화를 살려낸다', async () => {
    // Chrome은 continuous여도 침묵마다 세션을 닫고, 그때 확정 전 문장을 버린다.
    const view = await listening()

    act(() => instances[0].emit({ text: '아직 확정 안 된 말', final: false }))
    expect(view.result.current.interimText).toBe('아직 확정 안 된 말')
    expect(view.result.current.chunks).toHaveLength(0)

    act(() => instances[0].onend?.())

    expect(view.result.current.chunks).toHaveLength(1)
    expect(view.result.current.chunks[0].text).toBe('아직 확정 안 된 말')
    // 우리가 살려낸 값이지 Chrome이 확정해 준 값이 아니다.
    expect(view.result.current.chunks[0].isFinal).toBe(false)
    expect(view.result.current.interimText).toBe('')
  })

  it('중지할 때도 마지막 발화를 살려낸다', async () => {
    // 회의 끝머리가 통째로 사라지던 자리.
    const view = await listening()

    act(() => instances[0].emit({ text: '수고하셨습니다', final: false }))

    let finalChunks: ReturnType<typeof view.result.current.stopListening> = []
    act(() => {
      finalChunks = view.result.current.stopListening()
    })

    expect(finalChunks).toHaveLength(1)
    expect(finalChunks[0].text).toBe('수고하셨습니다')
  })

  it('stopListening이 렌더 시점이 아닌 최신 청크를 돌려준다', async () => {
    const view = await listening()

    act(() => instances[0].emit({ text: '첫 발화', final: true }))
    act(() => instances[0].emit({ text: '끝 발화', final: false }))

    let finalChunks: ReturnType<typeof view.result.current.stopListening> = []
    act(() => {
      finalChunks = view.result.current.stopListening()
    })

    expect(finalChunks.map((c) => c.text)).toEqual(['첫 발화', '끝 발화'])
  })

  it('살려낼 미확정 발화가 없으면 아무것도 추가하지 않는다', async () => {
    const view = await listening()

    act(() => instances[0].emit({ text: '확정된 말', final: true }))
    act(() => instances[0].onend?.())

    expect(view.result.current.chunks).toHaveLength(1)
  })

  it('재시작이 반복돼도 확정 전 발화가 매번 보존된다', async () => {
    const view = await listening()
    const recognition = instances[0]

    // flushInterim은 재시작 타이머보다 먼저, 동기로 돈다.
    for (let i = 0; i < 3; i++) {
      act(() => recognition.emit({ text: `구간 ${i}`, final: false }))
      act(() => recognition.onend?.())
    }

    expect(view.result.current.chunks.map((c) => c.text)).toEqual([
      '구간 0',
      '구간 1',
      '구간 2',
    ])
  })
})

describe('타임스탬프', () => {
  it('발화가 처음 들린 시각을 시작으로 잡는다', async () => {
    const origin = Date.now()
    const view = await listening(origin)

    const nowSpy = vi.spyOn(Date, 'now')

    nowSpy.mockReturnValue(origin + 5_000)
    act(() => instances[0].emit({ text: '말하는 중', final: false }))

    nowSpy.mockReturnValue(origin + 12_000)
    act(() => instances[0].emit({ text: '말하는 중입니다', final: true }))

    const chunk = view.result.current.chunks[0]
    // 하드코딩된 `끝 − 2초`(10초)가 아니라 실제로 들리기 시작한 5초여야 한다.
    expect(chunk.startTime).toBeCloseTo(5, 1)
    expect(chunk.endTime).toBeCloseTo(12, 1)

    nowSpy.mockRestore()
  })

  it('timeOrigin을 주면 그 기준으로 시각을 잰다', async () => {
    // 오디오 녹음 시작 시각을 넘기면 전사 타임스탬프가 파일 재생 위치와 맞는다.
    const origin = Date.now() - 30_000
    const view = await listening(origin)

    act(() => instances[0].emit({ text: '발화', final: true }))

    expect(view.result.current.chunks[0].endTime).toBeGreaterThan(29)
  })

  it('interim 없이 확정만 오면 기본 길이로 되돌아간다', async () => {
    const origin = Date.now()
    const view = await listening(origin)

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(origin + 8_000)
    act(() => instances[0].emit({ text: '갑자기 확정', final: true }))

    const chunk = view.result.current.chunks[0]
    expect(chunk.endTime).toBeCloseTo(8, 1)
    expect(chunk.startTime).toBeCloseTo(6, 1)

    nowSpy.mockRestore()
  })
})

describe('resetChunks', () => {
  it('청크와 유실 카운트를 함께 지운다', async () => {
    const view = await listening()

    act(() => instances[0].emit({ text: '발화', final: true }))
    act(() => instances[0].emit({ text: '', final: true }))
    act(() => view.result.current.resetChunks())

    expect(view.result.current.chunks).toHaveLength(0)
    expect(view.result.current.missedCount).toBe(0)
  })

  it('초기화 후 stopListening은 빈 배열', async () => {
    const view = await listening()

    act(() => instances[0].emit({ text: '발화', final: true }))
    act(() => view.result.current.resetChunks())

    let finalChunks: ReturnType<typeof view.result.current.stopListening> = []
    act(() => {
      finalChunks = view.result.current.stopListening()
    })
    expect(finalChunks).toEqual([])
  })
})
