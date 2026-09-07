export type TemplateId =
  | 'meeting'
  | 'lecture'
  | 'one_on_one'
  | 'brainstorm'
  | 'interview'
  | 'raw'
  | 'custom'

export type SummaryDepth = 'concise' | 'standard' | 'detailed'

export interface Template {
  id: TemplateId
  name: string
  icon: string
  description: string
  defaultDepth: SummaryDepth
  liveSupported: boolean
  depthAdjustable: boolean
  basePrompt: string
}

export const DEFAULT_TEMPLATE_ID: TemplateId = 'meeting'
export const DEFAULT_DEPTH: SummaryDepth = 'standard'

export const TEMPLATES: Record<Exclude<TemplateId, 'custom'>, Template> = {
  meeting: {
    id: 'meeting',
    name: '회의록',
    icon: '🗂️',
    description: '참석자 / 액션 아이템 중심',
    defaultDepth: 'standard',
    liveSupported: true,
    depthAdjustable: true,
    basePrompt: `당신은 회의록 작성 전문가입니다. 아래 발화 내용을 분석하여 마크다운 회의록을 작성하세요.

## 요약
회의 전체를 3~5줄로. 무엇을 논의했고 무엇이 정해졌는지.

이어지는 본문은 **섹션 제목을 직접 지어서** 구성하세요:
- 실제로 논의된 주제를 스스로 파악해 \`##\` 제목을 붙여 나눕니다.
- "주요 논의 사항", "논의 내용" 같은 일반적인 제목은 쓰지 마세요.
  이 회의가 무엇을 다뤘는지 제목만 봐도 알 수 있어야 합니다.
  (예: "단계별 개발 계획", "수익화 방안", "기술적 고려사항")
- 주제 수는 내용에 따라 정하되 보통 3~6개입니다.

## 액션 아이템
반드시 \`- [ ]\` 체크박스 형식으로 작성하세요.
담당자가 파악되면 \`(담당자)\`를 앞에, 기한이 언급됐으면 뒤에 덧붙입니다.
예: \`- [ ] (김지훈) 경쟁 사이트 리스트업 — 5/17까지\`
담당자가 불분명해도 해야 할 일이 명확하면 포함하세요.

## 결정 사항
- 합의되었거나 확정된 것만. 없으면 이 섹션을 생략하세요.`,
  },

  lecture: {
    id: 'lecture',
    name: '강의·세미나 노트',
    icon: '🎓',
    description: '주제별 핵심 개념과 예시',
    defaultDepth: 'detailed',
    liveSupported: true,
    depthAdjustable: true,
    basePrompt: `당신은 학습용 노트를 작성하는 전문가입니다. 강의/세미나 녹취를 구조화된 학습 자료로 정리하세요.

## 주요 주제
(한 줄 요약)

## 핵심 개념
각 개념마다 ### 소제목 + 설명 + 구체 예시
소제목은 강의에서 실제로 다룬 개념 이름을 그대로 쓰세요.

## 기억할 인용·예시
> 중요한 문장 인용 형식으로

## 후속 질문
- 스스로 탐구해볼 만한 질문`,
  },

  one_on_one: {
    id: 'one_on_one',
    name: '1:1 미팅',
    icon: '🤝',
    description: '고민 / 피드백 / 다음 액션',
    defaultDepth: 'standard',
    liveSupported: true,
    depthAdjustable: true,
    basePrompt: `당신은 1:1 미팅 정리 전문가입니다. 개인적이고 신뢰 기반의 대화임을 존중하며 정리하세요.

## 이번 세션 요지
(2~3줄)

이어서 대화에서 실제로 다룬 주제마다 **\`##\` 제목을 직접 지어** 나누세요.
"논의한 주제" 같은 일반적인 제목 대신, 무엇에 대한 이야기였는지 드러내는 제목을 쓰세요.

## 고민·블로커
- 공유된 어려움

## 받은·제공한 피드백
- 건설적 피드백 위주

## 다음 미팅까지 할 일
- [ ] 합의된 후속 조치. 담당자가 있으면 \`(담당자)\` 표기`,
  },

  brainstorm: {
    id: 'brainstorm',
    name: '브레인스토밍',
    icon: '💡',
    description: '아이디어 카테고리화 + 우선순위',
    defaultDepth: 'detailed',
    liveSupported: true,
    depthAdjustable: true,
    basePrompt: `당신은 브레인스토밍 세션을 정리하는 전문가입니다. 나온 아이디어를 분류하고 실행 가능성 관점에서 정리하세요.

## 세션 개요
(1~2줄 — 주제/목표)

## 아이디어 (카테고리별)
### [카테고리 이름]
카테고리는 미리 정해진 목록이 아니라, 나온 아이디어를 보고 직접 묶어서 이름 붙이세요.
- 아이디어 요약

## 즉시 시도 가능
- 빠르게 검증 가능한 것

## 보류·탈락
- 사유 간단히

## 다음 스텝
- [ ] 구체적인 후속 행동. 담당자가 있으면 \`(담당자)\` 표기`,
  },

  interview: {
    id: 'interview',
    name: '인터뷰',
    icon: '🎤',
    description: 'Q&A 포맷 + 인상적 발언',
    defaultDepth: 'standard',
    liveSupported: false,
    depthAdjustable: true,
    basePrompt: `당신은 인터뷰 녹취를 Q&A 형식으로 정리하는 전문가입니다.

## 개요
(인터뷰 대상/주제 1~2줄)

## Q&A
**Q: [질문]**
A: [답변 요약]

(의미있는 Q&A 쌍을 순서대로)

## 인상적 발언
> 직접 인용

## 종합 인상
- 전반적 테마 / 놓치지 말 것`,
  },

  raw: {
    id: 'raw',
    name: '원문 정리',
    icon: '📝',
    description: '요약 없이 문단화·오탈자 정리만',
    defaultDepth: 'detailed',
    liveSupported: false,
    depthAdjustable: false,
    basePrompt: `당신은 음성 인식 텍스트의 편집자입니다. 요약이나 재해석 없이 다음만 수행하세요:
- 문장을 자연스러운 문단으로 묶기
- 명백한 오탈자 교정
- 의미 없는 반복 / 군더더기 최소한 제거
- 시간 순서 유지

엄격한 규칙:
- 내용을 삭제하거나 축약하지 마세요
- 구조적 제목(## 섹션)을 덧붙이지 마세요
- 타임스탬프가 있으면 그대로 유지하세요`,
  },
}

const DEPTH_MODIFIERS: Record<SummaryDepth, string> = {
  concise:
    '작성 강도: **간결**. 각 섹션은 3줄 이내로 핵심만. 부연 설명과 맥락은 생략하세요.',
  standard:
    '작성 강도: **표준**. 읽는 사람이 맥락을 이해할 수 있도록 적절한 상세도로 작성하세요.',
  detailed:
    '작성 강도: **상세**. 원문의 주요 세부사항·수치·고유명사를 누락 없이 포함하세요. 구조만 바꾸고 내용은 최대한 보존합니다.',
}

const LIVE_MODIFIER = `회의가 아직 진행 중입니다. 지금까지의 내용을 기반으로 **중간 정리**를 작성하세요. 확정되지 않은 결정은 "(논의 중)"으로 표시하세요.
섹션 제목은 지금까지 나온 주제를 기준으로 붙이되, 이후 갱신될 수 있으므로 간결하게 유지하세요.`

/**
 * 프리셋 템플릿 전체에 공통으로 덧붙는 규칙.
 *
 * custom 프롬프트에는 적용하지 않는다 — 사용자가 전적으로 제어하는 영역이기 때문.
 */
const COMMON_RULES = `공통 규칙:
- 발화에 없는 내용을 지어내지 마세요. 불확실하면 쓰지 마세요.
- 발화자 표기가 있다면 누가 무엇을 주장하고 약속했는지 반영하세요.
- 영어 기술 용어·제품명은 번역하거나 음차하지 말고 원문 표기를 유지하세요 (예: latency, deployment).
- 한국어로 작성하세요.`

export interface BuildPromptArgs {
  templateId: TemplateId
  depth: SummaryDepth
  transcript: string
  live?: boolean
  customPrompt?: string
}

export function getTemplate(id: TemplateId): Template | null {
  if (id === 'custom') return null
  return TEMPLATES[id] ?? null
}

export function resolveDepth(
  templateId: TemplateId,
  depth?: SummaryDepth,
): SummaryDepth {
  if (templateId === 'custom') return depth ?? DEFAULT_DEPTH
  const template = TEMPLATES[templateId]
  if (!template) return DEFAULT_DEPTH
  if (!template.depthAdjustable) return template.defaultDepth
  return depth ?? template.defaultDepth
}

export function buildPrompt(args: BuildPromptArgs): string {
  const { templateId, depth, transcript, live = false, customPrompt } = args

  let instruction: string

  if (templateId === 'custom') {
    const custom = customPrompt?.trim()
    if (!custom) {
      instruction = `${TEMPLATES.meeting.basePrompt}\n\n${COMMON_RULES}`
    } else {
      instruction = custom
    }
  } else {
    const template = TEMPLATES[templateId] ?? TEMPLATES.meeting
    const parts: string[] = [template.basePrompt]

    if (template.depthAdjustable) {
      parts.push(DEPTH_MODIFIERS[depth])
    }

    if (live && template.liveSupported) {
      parts.push(LIVE_MODIFIER)
    }

    parts.push(COMMON_RULES)

    instruction = parts.join('\n\n')
  }

  return `${instruction}\n\n---\n음성 인식 텍스트:\n${transcript}`
}

export function liveEnabledFor(templateId: TemplateId): boolean {
  if (templateId === 'custom') return true
  return TEMPLATES[templateId]?.liveSupported ?? true
}

export function depthAdjustableFor(templateId: TemplateId): boolean {
  if (templateId === 'custom') return false
  return TEMPLATES[templateId]?.depthAdjustable ?? true
}
