export interface ParsedActionItem {
  task: string
  isDone: boolean
}

const CHECKBOX_LINE = /^\s*[-*]\s+\[(x|X|\s)\]\s+(.+)\s*$/

/**
 * 마크다운 텍스트에서 GFM 체크박스 줄(- [ ] / - [x])을 추출.
 * "## 액션 아이템" 같은 섹션 안에 있든 어디 있든 모두 수집.
 *
 * 빈 task / 매우 짧은 task("none", "...")는 제외하여 노이즈 감소.
 */
export function parseActionItems(markdown: string): ParsedActionItem[] {
  if (!markdown) return []

  const items: ParsedActionItem[] = []
  for (const line of markdown.split('\n')) {
    const match = line.match(CHECKBOX_LINE)
    if (!match) continue

    const checked = match[1].toLowerCase() === 'x'
    const task = match[2].trim()
    if (task.length === 0) continue
    if (task.length < 2) continue
    if (/^[.…]+$/.test(task)) continue

    items.push({ task, isDone: checked })
  }
  return items
}
