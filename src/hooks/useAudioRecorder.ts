'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AUDIO_BITS_PER_SECOND,
  CHUNK_INTERVAL_MS,
  RECORDING_AUDIO_CONSTRAINTS,
  pickRecorderMimeType,
  recordingDownloadName,
} from '@/lib/recording'

export interface CompletedRecording {
  /** 서버 세션 id. 세션 생성에 실패했으면 null이고 로컬 사본만 있다. */
  recordingId: string | null
  mimeType: string
  blob: Blob
  durationMs: number
  startedAt: Date
  /** 서버에 실제로 저장된 바이트. 0이거나 blob보다 작으면 일부가 못 올라갔다. */
  uploadedBytes: number
}

export interface AudioRecorderHook {
  isRecording: boolean
  isSupported: boolean | null
  /** 녹음을 시작조차 못하게 만든 오류. */
  error: string | null
  /** 녹음은 되고 있으나 서버 사본에 문제가 있을 때의 경고. */
  uploadWarning: string | null
  elapsedMs: number
  localBytes: number
  uploadedBytes: number
  recording: CompletedRecording | null
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  downloadRecording: (title: string) => void
  reset: () => void
}

const MAX_CHUNK_RETRIES = 3

function describeCaptureError(err: unknown): string {
  const name = err instanceof Error ? err.name : ''

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '마이크 권한이 거부되어 녹음할 수 없습니다. 주소창 왼쪽 자물쇠 아이콘에서 마이크를 허용해주세요.'
    case 'NotFoundError':
      return '마이크를 찾을 수 없습니다. 장치가 연결되어 있는지 확인해주세요.'
    case 'NotReadableError':
      return '다른 프로그램이 마이크를 사용 중입니다. 해당 프로그램을 종료하고 다시 시도해주세요.'
    default:
      return err instanceof Error
        ? `마이크를 열 수 없습니다: ${err.message}`
        : '마이크를 열 수 없습니다.'
  }
}

/**
 * 회의 오디오를 파일로 남긴다.
 *
 * 전사와 독립적으로 동작한다. Web Speech가 발화를 놓치든 네트워크가 끊기든
 * 오디오만은 남아야 나중에 서버 STT로 다시 살릴 수 있다. 그래서 서버 업로드가
 * 실패해도 녹음을 중단하지 않고, 브라우저 안의 사본을 끝까지 들고 간다.
 */
export function useAudioRecorder(): AudioRecorderHook {
  const [isSupported, setIsSupported] = useState<boolean | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadWarning, setUploadWarning] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [localBytes, setLocalBytes] = useState(0)
  const [uploadedBytes, setUploadedBytes] = useState(0)
  const [recording, setRecording] = useState<CompletedRecording | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const partsRef = useRef<Blob[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const mimeTypeRef = useRef<string | null>(null)
  const startedAtRef = useRef<Date | null>(null)
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve())
  const uploadBrokenRef = useRef(false)

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia,
    )
  }, [])

  // 녹음 중에는 1초마다 경과 시간을 갱신한다. 이 시각이 나중에 전사 청크를
  // 오디오 타임라인에 맞추는 기준이 된다.
  useEffect(() => {
    if (!isRecording) return

    const timer = setInterval(() => {
      if (startedAtRef.current) {
        setElapsedMs(Date.now() - startedAtRef.current.getTime())
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [isRecording])

  // 녹음 중 탭을 닫으면 아직 못 올린 조각이 사라진다. 확인을 한 번 받는다.
  useEffect(() => {
    if (!isRecording) return

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isRecording])

  /**
   * 조각을 순서대로 올린다.
   *
   * 순서가 곧 파일의 순서이므로 병렬로 보내지 않는다. 한 조각이 끝내 실패하면
   * 그 뒤를 이어 붙여봐야 중간이 비어 재생도 전사도 안 되는 파일이 되므로,
   * 그 시점에 업로드를 멈추고 로컬 사본을 쓰라고 알린다.
   */
  const queueUpload = useCallback((chunk: Blob) => {
    const id = sessionIdRef.current
    if (!id || uploadBrokenRef.current) return

    uploadChainRef.current = uploadChainRef.current.then(async () => {
      if (uploadBrokenRef.current) return

      for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
        try {
          const res = await fetch(`/api/recordings/${id}/chunk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: chunk,
          })

          if (res.ok) {
            const data = await res.json()
            setUploadedBytes(data.bytes)
            return
          }

          // 4xx는 재시도해도 같은 답이 온다.
          if (res.status >= 400 && res.status < 500) break
        } catch {
          // 네트워크 오류 — 아래에서 재시도한다.
        }

        if (attempt < MAX_CHUNK_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
        }
      }

      uploadBrokenRef.current = true
      setUploadWarning(
        '서버 저장이 중단되었습니다. 녹음은 계속되고 있으니 종료 후 반드시 오디오를 내려받아 주세요.',
      )
    })
  }, [])

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return

    setError(null)
    setUploadWarning(null)
    setRecording(null)
    setElapsedMs(0)
    setLocalBytes(0)
    setUploadedBytes(0)
    partsRef.current = []
    sessionIdRef.current = null
    uploadBrokenRef.current = false
    uploadChainRef.current = Promise.resolve()

    if (isSupported !== true) {
      setError('이 브라우저는 오디오 녹음을 지원하지 않습니다. Chrome을 사용해주세요.')
      return
    }

    const mimeType = pickRecorderMimeType((type) =>
      MediaRecorder.isTypeSupported(type),
    )
    if (!mimeType) {
      setError('브라우저가 지원하는 녹음 형식을 찾지 못했습니다.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: RECORDING_AUDIO_CONSTRAINTS,
      })
    } catch (err) {
      setError(describeCaptureError(err))
      return
    }

    // 서버 세션은 있으면 좋고 없어도 녹음은 간다. 여기서 포기하면
    // 오디오를 남기려던 목적 자체를 잃는다.
    try {
      const res = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType }),
      })

      if (res.ok) {
        const meta = await res.json()
        sessionIdRef.current = meta.id
      } else {
        uploadBrokenRef.current = true
        setUploadWarning(
          '서버에 녹음 세션을 만들지 못했습니다. 브라우저에만 저장되니 종료 후 반드시 내려받아 주세요.',
        )
      }
    } catch {
      uploadBrokenRef.current = true
      setUploadWarning(
        '서버에 연결하지 못했습니다. 브라우저에만 저장되니 종료 후 반드시 내려받아 주세요.',
      )
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    })

    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return
      partsRef.current.push(event.data)
      setLocalBytes((prev) => prev + event.data.size)
      queueUpload(event.data)
    }

    recorder.onerror = () => {
      setError('녹음 중 오류가 발생했습니다. 지금까지의 오디오는 보존되어 있습니다.')
    }

    streamRef.current = stream
    recorderRef.current = recorder
    mimeTypeRef.current = mimeType
    startedAtRef.current = new Date()

    recorder.start(CHUNK_INTERVAL_MS)
    setIsRecording(true)
  }, [isSupported, queueUpload])

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current
    if (!recorder) return
    recorderRef.current = null

    // stop()은 남은 버퍼를 dataavailable로 한 번 더 내보낸 뒤 stop을 쏜다.
    // 그 마지막 조각까지 받아야 회의 끝부분이 잘리지 않는다.
    if (recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true })
        recorder.stop()
      })
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    await uploadChainRef.current

    const startedAt = startedAtRef.current ?? new Date()
    const durationMs = Date.now() - startedAt.getTime()
    const mimeType = mimeTypeRef.current ?? 'audio/webm'
    const id = sessionIdRef.current

    const blob = new Blob(partsRef.current, { type: mimeType })

    // 한 바이트도 못 받았으면 보관됐다고 말하면 안 된다. 이 기능의 요점은
    // 오디오가 남는 것인데, 남지 않았는데 남았다고 알리면 사용자는 회의가
    // 끝난 뒤에야 아무것도 없다는 걸 알게 된다.
    if (blob.size === 0) {
      setError(
        '오디오가 한 조각도 캡처되지 않았습니다. 마이크 입력 장치를 확인하고 다시 녹음해주세요.',
      )
      setElapsedMs(durationMs)
      setIsRecording(false)
      return
    }

    let serverBytes = 0
    if (id && !uploadBrokenRef.current) {
      try {
        const res = await fetch(`/api/recordings/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationMs }),
        })
        if (res.ok) {
          serverBytes = (await res.json()).bytes ?? 0
        }
      } catch {
        setUploadWarning(
          '녹음 종료 처리에 실패했습니다. 저장된 조각은 남아 있지만, 로컬 사본도 내려받아 두시길 권합니다.',
        )
      }
    }

    // 서버 사본이 로컬보다 짧으면 조각이 새어나간 것이다. 조용히 넘기지 않는다.
    if (id && !uploadBrokenRef.current && serverBytes < blob.size) {
      setUploadWarning(
        `서버 사본이 로컬보다 짧습니다 (${serverBytes} / ${blob.size} bytes). 오디오를 내려받아 보관해주세요.`,
      )
    }

    setElapsedMs(durationMs)
    setUploadedBytes(serverBytes)
    setRecording({
      recordingId: uploadBrokenRef.current ? null : id,
      mimeType,
      blob,
      durationMs,
      startedAt,
      uploadedBytes: serverBytes,
    })
    setIsRecording(false)
  }, [])

  const downloadRecording = useCallback((title: string) => {
    const parts = partsRef.current
    if (parts.length === 0) return

    const mimeType = mimeTypeRef.current ?? 'audio/webm'
    const blob = new Blob(parts, { type: mimeType })
    const url = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = recordingDownloadName(
      title,
      startedAtRef.current ?? new Date(),
      mimeType,
    )
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }, [])

  const reset = useCallback(() => {
    partsRef.current = []
    sessionIdRef.current = null
    startedAtRef.current = null
    uploadBrokenRef.current = false
    setRecording(null)
    setElapsedMs(0)
    setLocalBytes(0)
    setUploadedBytes(0)
    setError(null)
    setUploadWarning(null)
  }, [])

  // 언마운트 시 마이크를 놓아준다. 탭 표시등이 켜진 채 남지 않도록.
  useEffect(() => {
    return () => {
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return {
    isRecording,
    isSupported,
    error,
    uploadWarning,
    elapsedMs,
    localBytes,
    uploadedBytes,
    recording,
    startRecording,
    stopRecording,
    downloadRecording,
    reset,
  }
}
