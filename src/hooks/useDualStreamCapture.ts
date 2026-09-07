'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type CaptureMode = 'idle' | 'mic-only' | 'dual-stream'

interface DualStreamCapture {
  mode: CaptureMode
  /** 내 목소리 트랙 (마이크) */
  micTrack: MediaStreamTrack | null
  /** 상대 목소리 트랙 (시스템·탭 오디오). 화면 공유를 거부하거나 오디오를 안 켜면 null */
  systemTrack: MediaStreamTrack | null
  error: string | null
  /** 시스템 오디오 없이 마이크만 잡힌 경우의 안내 */
  warning: string | null
  start: (options?: { withSystemAudio?: boolean }) => Promise<void>
  stop: () => void
}

function describeCaptureError(err: unknown): string {
  if (!(err instanceof Error)) return '오디오 캡처에 실패했습니다.'

  switch (err.name) {
    case 'NotAllowedError':
      return '오디오 캡처 권한이 거부되었습니다. 마이크와 화면 공유를 모두 허용해주세요.'
    case 'NotFoundError':
      return '사용할 수 있는 마이크를 찾을 수 없습니다.'
    case 'NotReadableError':
      return '다른 앱이 마이크를 사용 중입니다. 해당 앱을 종료하고 다시 시도해주세요.'
    default:
      return `오디오 캡처 실패: ${err.message}`
  }
}

/**
 * 화자 분리를 위한 2트랙 캡처.
 *
 * 내 마이크와 시스템(탭) 오디오를 **별도 트랙으로** 잡는다. 트랙이 곧 화자이므로
 * 추론 없이 정확도 100%로 화자가 갈린다. 원격 1:1 회의를 겨냥한 경로다.
 *
 * 시스템 오디오는 Chrome/Windows와 Chrome 141+/macOS 14.2+ 에서만 캡처된다.
 * 실패하면 마이크 단독 모드로 떨어지며, 그 경우 화자 분리는 되지 않는다.
 */
export function useDualStreamCapture(): DualStreamCapture {
  const [mode, setMode] = useState<CaptureMode>('idle')
  const [micTrack, setMicTrack] = useState<MediaStreamTrack | null>(null)
  const [systemTrack, setSystemTrack] = useState<MediaStreamTrack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const streamsRef = useRef<MediaStream[]>([])

  const stop = useCallback(() => {
    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) track.stop()
    }
    streamsRef.current = []
    setMicTrack(null)
    setSystemTrack(null)
    setMode('idle')
  }, [])

  const start = useCallback(
    async (options?: { withSystemAudio?: boolean }) => {
      const withSystemAudio = options?.withSystemAudio ?? true

      setError(null)
      setWarning(null)

      let micStream: MediaStream
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        setError(describeCaptureError(err))
        return
      }
      streamsRef.current.push(micStream)
      const mic = micStream.getAudioTracks()[0] ?? null
      setMicTrack(mic)

      if (!withSystemAudio) {
        setMode('mic-only')
        return
      }

      try {
        // 오디오만 필요해도 video:true를 함께 요청해야 한다 (스펙 요구사항).
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        })
        streamsRef.current.push(displayStream)

        // 영상은 쓰지 않으므로 즉시 끊어 자원과 프라이버시 노출을 줄인다.
        for (const track of displayStream.getVideoTracks()) track.stop()

        const system = displayStream.getAudioTracks()[0] ?? null
        if (!system) {
          setWarning(
            '시스템 오디오가 공유되지 않아 화자 분리가 비활성화됩니다. 공유 대화상자에서 "탭 오디오 공유"를 켜주세요.',
          )
          setMode('mic-only')
          return
        }

        setSystemTrack(system)
        setMode('dual-stream')
      } catch (err) {
        setWarning(
          `${describeCaptureError(err)} 마이크만으로 계속 녹음합니다 (화자 분리 없음).`,
        )
        setMode('mic-only')
      }
    },
    [],
  )

  useEffect(() => stop, [stop])

  return { mode, micTrack, systemTrack, error, warning, start, stop }
}
