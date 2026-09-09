import { complete, toProviderSettings, type ProviderSettings } from './providers'

/**
 * 긴 회의 처리.
 *
 * 예전에는 10만 자를 넘으면 `/api/summarize`가 413으로 **거부**했다. 3시간짜리
 * 회의를 마치고 회의록을 만들려는 순간 아무것도 못 받는다는 뜻이다. 유실을
 * 막자고 만든 파이프라인의 끝에서 결과를 통째로 버리는 셈이었다.
 *
 * 이제는 구간별로 한 번 압축한 뒤(map), 압축본을 모아 평소와 똑같은 템플릿
 * 경로로 회의록을 만든다(reduce). 최종 출력이 짧은 회의와 같은 프롬프트를
 * 타므로 서식이 흔들리지 않는다.
 */

/** 이 길이를 넘으면 한 번에 못 넣는다고 보고 압축 단계를 거친다. */
export const SINGLE_PASS_CHAR_LIMIT = 60_000

/** 압축 단계에서 한 번에 넣을 구간 크기. */
export const CONDENSE_WINDOW_CHARS = 40_000

/** 이걸 넘으면 압축을 해도 감당이 안 된다고 보고 거부한다(약 14시간 분량). */
export const MAX_TRANSCRIPT_CHARS = 500_000

/**
 * 전사문을 줄 경계에서 잘라 구간으로 나눈다.
 *
 * 한 줄이 통째로 상한을 넘으면(타임스탬프 없는 긴 문단) 그 줄만 강제로 자른다.
 * 어떤 경우에도 원문의 어느 부분도 버리지 않는다.
 */
export function planTranscriptWindows(
  transcript: string,
  maxChars: number = CONDENSE_WINDOW_CHARS,
): string[] {
  if (maxChars <= 0) throw new Error('maxChars는 1 이상이어야 한다')

  const text = transcript.trim()
  if (text.length === 0) return []
  if (text.length <= maxChars) return [text]

  const windows: string[] = []
  let current: string[] = []
  let currentLength = 0

  function flush() {
    if (current.length === 0) return
    windows.push(current.join('\n'))
    current = []
    currentLength = 0
  }

  for (const line of text.split('\n')) {
    // 줄 하나가 상한보다 길면 쪼개는 수밖에 없다.
    if (line.length > maxChars) {
      flush()
      for (let i = 0; i < line.length; i += maxChars) {
        windows.push(line.slice(i, i + maxChars))
      }
      continue
    }

    const projected = currentLength + line.length + (current.length > 0 ? 1 : 0)
    if (projected > maxChars) flush()

    current.push(line)
    currentLength += line.length + (current.length > 1 ? 1 : 0)
  }

  flush()
  return windows
}

function buildCondensePrompt(
  window: string,
  index: number,
  total: number,
): string {
  return [
    `다음은 회의 전사문의 ${index + 1}/${total} 구간입니다.`,
    '',
    '이 구간에서 오간 내용을 빠짐없이 정리하세요. 이 정리본만 보고 회의록을',
    '작성하게 되므로, 뒤에서 쓰일 정보를 잃으면 안 됩니다.',
    '',
    '규칙:',
    '- 논의된 주제, 결정된 사항, 할 일, 숫자·날짜·고유명사를 모두 남깁니다.',
    '- 누가 말했는지 드러나면 함께 적습니다.',
    '- 인사말·잡담·중복은 덜어냅니다.',
    '- 회의록 서식으로 만들지 말고, 사실을 담은 개조식 메모로만 정리합니다.',
    '- 앞뒤 구간을 추측해 채우지 않습니다. 이 구간에 있는 내용만 씁니다.',
    '',
    '---',
    window,
  ].join('\n')
}

export interface CondenseOptions {
  provider?: ProviderSettings
  apiKey?: string
  windowChars?: number
  fetchFn?: typeof fetch
}

export type CondenseResult =
  | { success: true; text: string; windows: number }
  | { success: false; error: string; rateLimited?: boolean }

/**
 * 긴 전사문을 구간별로 압축한다.
 *
 * 한 구간이라도 실패하면 전체를 실패로 돌린다. 일부만 빠진 압축본으로 회의록을
 * 만들면 사용자는 무엇이 빠졌는지 모른 채 멀쩡해 보이는 문서를 받게 된다.
 */
export async function condenseTranscript(
  transcript: string,
  options: CondenseOptions = {},
): Promise<CondenseResult> {
  const settings = toProviderSettings(options.provider, options.apiKey)
  const windows = planTranscriptWindows(
    transcript,
    options.windowChars ?? CONDENSE_WINDOW_CHARS,
  )

  if (windows.length === 0) {
    return { success: false, error: '요약할 텍스트가 비어 있습니다.' }
  }

  const condensed: string[] = []

  for (const [index, window] of windows.entries()) {
    const result = await complete(
      buildCondensePrompt(window, index, windows.length),
      settings,
      { fetchFn: options.fetchFn },
    )

    if (!result.success) {
      return {
        success: false,
        error: `${index + 1}/${windows.length} 구간 정리 실패: ${result.error}`,
        ...(result.rateLimited ? { rateLimited: true } : {}),
      }
    }

    const text = result.text.trim()
    if (text.length === 0) {
      return {
        success: false,
        error: `${index + 1}/${windows.length} 구간 정리 결과가 비어 있습니다.`,
      }
    }

    condensed.push(`## 구간 ${index + 1}/${windows.length}\n\n${text}`)
  }

  return {
    success: true,
    text: condensed.join('\n\n'),
    windows: windows.length,
  }
}
