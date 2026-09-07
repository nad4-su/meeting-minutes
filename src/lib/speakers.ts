/**
 * 화자 식별자.
 *
 * dual-stream 캡처에서는 트랙이 곧 화자이므로 추론이 개입하지 않는다.
 * 단일 트랙에서 화자를 추정하는 경로가 생기면 'spk_1' 같은 식별자가 추가된다.
 */
export const LOCAL_SPEAKER = 'local'
export const REMOTE_SPEAKER = 'remote'

export type SpeakerNames = Readonly<Record<string, string>>

const DEFAULT_NAMES: SpeakerNames = {
  [LOCAL_SPEAKER]: '나',
  [REMOTE_SPEAKER]: '상대',
}

/** 화자 식별자를 표시용 이름으로 바꾼다. 사용자가 지정한 이름이 우선한다. */
export function resolveSpeakerName(
  speaker: string,
  names?: SpeakerNames,
): string {
  const custom = names?.[speaker]?.trim()
  if (custom) return custom

  const preset = DEFAULT_NAMES[speaker]
  if (preset) return preset

  return speaker
}

/** 회의록에 저장할 참석자 목록. 지정된 이름이 없으면 기본 표기를 쓴다. */
export function listAttendees(
  speakers: readonly string[],
  names?: SpeakerNames,
): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const speaker of speakers) {
    if (seen.has(speaker)) continue
    seen.add(speaker)
    result.push(resolveSpeakerName(speaker, names))
  }

  return result
}
