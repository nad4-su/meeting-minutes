/**
 * 회의 오디오 녹음 — 브라우저·서버가 공유하는 상수와 순수 함수.
 *
 * 녹음의 목적은 재생이 아니라 **재전사**다. Web Speech가 놓친 발화를 나중에
 * 서버 STT로 되살리려면 원본 오디오가 남아 있어야 한다. 그래서 전사와
 * 무관하게, 전사가 실패하더라도 오디오만은 반드시 파일로 남긴다.
 */

/** MediaRecorder에 우선순위대로 시도할 컨테이너/코덱. */
export const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
] as const

/**
 * 대면 회의 기준 캡처 제약.
 *
 * 브라우저 기본값은 세 가지가 모두 켜져 있고 전화 통화용으로 튜닝돼 있다.
 * 노이즈 억제는 멀리 앉은 화자의 목소리를 노이즈로 오판해 지워버릴 수 있고,
 * 에코 제거는 스피커 출력이 없는 대면 회의에서는 얻을 게 없다. 둘 다 끈다.
 * 반면 AGC는 조용한 화자의 레벨을 끌어올려 주므로 남긴다.
 *
 * 원격 회의(스피커 출력이 마이크로 되먹임되는 경우)에는 echoCancellation을
 * 다시 켜야 한다. 그 경로는 dual-stream 캡처와 함께 다룬다.
 */
export const RECORDING_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true,
}

/**
 * 서버로 조각을 올리는 간격.
 *
 * 짧을수록 탭이 죽었을 때 잃는 양이 적고, 길수록 요청 수가 준다. 15초면
 * 최악의 경우에도 15초치만 잃는다.
 */
export const CHUNK_INTERVAL_MS = 15_000

/** 음성 전용이므로 128kbps면 STT에 충분하고도 남는다. */
export const AUDIO_BITS_PER_SECOND = 128_000

/** 회의 하나의 상한. 128kbps 기준 약 8.6시간. */
export const MAX_RECORDING_BYTES = 500 * 1024 * 1024

/** 조각 하나의 상한. 15초 × 128kbps면 240KB 남짓이라 넉넉하다. */
export const MAX_CHUNK_BYTES = 8 * 1024 * 1024

/** 브라우저가 지원하는 첫 번째 후보를 고른다. 없으면 null. */
export function pickRecorderMimeType(
  isTypeSupported: (type: string) => boolean,
): string | null {
  for (const type of PREFERRED_MIME_TYPES) {
    if (isTypeSupported(type)) return type
  }
  return null
}

/** `audio/webm;codecs=opus` → `webm` */
export function extensionForMimeType(mimeType: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase()

  switch (base) {
    case 'audio/webm':
      return 'webm'
    case 'audio/ogg':
      return 'ogg'
    case 'audio/mp4':
    case 'audio/x-m4a':
      return 'm4a'
    case 'audio/mpeg':
      return 'mp3'
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav'
    case 'audio/flac':
      return 'flac'
    default:
      return 'bin'
  }
}

/**
 * 녹음 세션 식별자 검증.
 *
 * 이 값이 그대로 파일 경로가 되므로 `..`이나 구분자가 섞이면 안 된다.
 * 경로 조립 전에 반드시 통과시킨다.
 */
const RECORDING_ID_PATTERN = /^[0-9a-f]{32}$/

export function isValidRecordingId(id: unknown): id is string {
  return typeof id === 'string' && RECORDING_ID_PATTERN.test(id)
}

/** 사용자가 내려받을 때 보게 될 파일 이름. */
export function recordingDownloadName(
  title: string,
  startedAt: Date,
  mimeType: string,
): string {
  const stamp = [
    startedAt.getFullYear(),
    String(startedAt.getMonth() + 1).padStart(2, '0'),
    String(startedAt.getDate()).padStart(2, '0'),
    '-',
    String(startedAt.getHours()).padStart(2, '0'),
    String(startedAt.getMinutes()).padStart(2, '0'),
  ].join('')

  const safeTitle = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60)

  const stem = safeTitle.length > 0 ? `${stamp}_${safeTitle}` : stamp
  return `${stem}.${extensionForMimeType(mimeType)}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0B'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
