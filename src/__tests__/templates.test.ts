import { describe, it, expect } from 'vitest'
import {
  TEMPLATES,
  buildPrompt,
  resolveDepth,
  liveEnabledFor,
  depthAdjustableFor,
  DEFAULT_TEMPLATE_ID,
  DEFAULT_DEPTH,
} from '@/lib/templates'

describe('TEMPLATES registry', () => {
  it('6개의 프리셋 템플릿을 제공한다', () => {
    expect(Object.keys(TEMPLATES)).toHaveLength(6)
    expect(TEMPLATES).toHaveProperty('meeting')
    expect(TEMPLATES).toHaveProperty('lecture')
    expect(TEMPLATES).toHaveProperty('one_on_one')
    expect(TEMPLATES).toHaveProperty('brainstorm')
    expect(TEMPLATES).toHaveProperty('interview')
    expect(TEMPLATES).toHaveProperty('raw')
  })

  it('기본 템플릿은 meeting, 기본 강도는 standard', () => {
    expect(DEFAULT_TEMPLATE_ID).toBe('meeting')
    expect(DEFAULT_DEPTH).toBe('standard')
  })

  it('raw 템플릿은 라이브 요약과 강도 조절이 불가', () => {
    expect(TEMPLATES.raw.liveSupported).toBe(false)
    expect(TEMPLATES.raw.depthAdjustable).toBe(false)
  })

  it('interview 템플릿은 라이브 요약 불가', () => {
    expect(TEMPLATES.interview.liveSupported).toBe(false)
  })

  it('lecture는 detailed, meeting은 standard 기본 강도', () => {
    expect(TEMPLATES.lecture.defaultDepth).toBe('detailed')
    expect(TEMPLATES.meeting.defaultDepth).toBe('standard')
  })
})

describe('buildPrompt', () => {
  const transcript = '안녕하세요 테스트입니다'

  it('meeting + standard + non-live 조합의 프롬프트를 생성한다', () => {
    const prompt = buildPrompt({
      templateId: 'meeting',
      depth: 'standard',
      transcript,
    })
    expect(prompt).toContain('회의록 작성 전문가')
    expect(prompt).toContain('액션 아이템')
    expect(prompt).toContain('표준')
    expect(prompt).toContain(transcript)
    expect(prompt).not.toContain('회의가 아직 진행 중')
  })

  it('live=true이면 진행 중 모디파이어를 포함한다', () => {
    const prompt = buildPrompt({
      templateId: 'meeting',
      depth: 'standard',
      transcript,
      live: true,
    })
    expect(prompt).toContain('회의가 아직 진행 중')
    expect(prompt).toContain('논의 중')
  })

  it('depthAdjustable=false인 raw 템플릿은 강도 모디파이어를 적용하지 않는다', () => {
    const prompt = buildPrompt({
      templateId: 'raw',
      depth: 'concise',
      transcript,
    })
    expect(prompt).toContain('편집자')
    expect(prompt).not.toContain('작성 강도')
  })

  it('liveSupported=false 템플릿은 live=true여도 라이브 모디파이어를 넣지 않는다', () => {
    const prompt = buildPrompt({
      templateId: 'interview',
      depth: 'standard',
      transcript,
      live: true,
    })
    expect(prompt).not.toContain('회의가 아직 진행 중')
  })

  it('강도별로 다른 모디파이어가 포함된다', () => {
    const concise = buildPrompt({
      templateId: 'meeting',
      depth: 'concise',
      transcript,
    })
    const detailed = buildPrompt({
      templateId: 'meeting',
      depth: 'detailed',
      transcript,
    })
    expect(concise).toContain('간결')
    expect(detailed).toContain('상세')
    expect(concise).not.toContain('상세')
  })

  it('custom 템플릿은 customPrompt를 그대로 사용한다', () => {
    const prompt = buildPrompt({
      templateId: 'custom',
      depth: 'standard',
      transcript,
      customPrompt: '당신은 시인입니다. 시 형식으로 정리하세요.',
    })
    expect(prompt).toContain('당신은 시인입니다')
    expect(prompt).toContain(transcript)
    expect(prompt).not.toContain('액션 아이템')
  })

  it('custom인데 customPrompt가 비어있으면 meeting 기본 프롬프트로 폴백', () => {
    const prompt = buildPrompt({
      templateId: 'custom',
      depth: 'standard',
      transcript,
      customPrompt: '   ',
    })
    expect(prompt).toContain('회의록 작성 전문가')
  })
})

describe('resolveDepth', () => {
  it('depth 미지정 시 템플릿 기본값을 반환한다', () => {
    expect(resolveDepth('lecture')).toBe('detailed')
    expect(resolveDepth('meeting')).toBe('standard')
  })

  it('depthAdjustable=false 템플릿은 전달된 depth를 무시', () => {
    expect(resolveDepth('raw', 'concise')).toBe('detailed')
  })

  it('지정된 depth가 있고 조절 가능하면 그대로 반환', () => {
    expect(resolveDepth('meeting', 'concise')).toBe('concise')
  })
})

describe('liveEnabledFor / depthAdjustableFor', () => {
  it('raw는 라이브/강도 둘 다 false', () => {
    expect(liveEnabledFor('raw')).toBe(false)
    expect(depthAdjustableFor('raw')).toBe(false)
  })

  it('interview는 라이브 false, 강도 true', () => {
    expect(liveEnabledFor('interview')).toBe(false)
    expect(depthAdjustableFor('interview')).toBe(true)
  })

  it('meeting / lecture / brainstorm / one_on_one은 둘 다 true', () => {
    expect(liveEnabledFor('meeting')).toBe(true)
    expect(liveEnabledFor('lecture')).toBe(true)
    expect(liveEnabledFor('brainstorm')).toBe(true)
    expect(liveEnabledFor('one_on_one')).toBe(true)
  })

  it('custom은 라이브 가능, 강도 조절은 불가(사용자 프롬프트가 강도까지 지정)', () => {
    expect(liveEnabledFor('custom')).toBe(true)
    expect(depthAdjustableFor('custom')).toBe(false)
  })
})

describe('내용 기반 섹션 구조', () => {
  const transcript = '이번에는 가격 비교 사이트를 만들어 봅시다'

  it('meeting은 섹션 제목을 직접 짓도록 지시한다', () => {
    const prompt = buildPrompt({
      templateId: 'meeting',
      depth: 'standard',
      transcript,
    })
    expect(prompt).toContain('섹션 제목을 직접 지어서')
    // 고정 제목을 쓰지 말라는 지시가 함께 있어야 한다
    expect(prompt).toContain('일반적인 제목은 쓰지 마세요')
  })

  it('one_on_one도 주제별 제목을 직접 짓도록 지시한다', () => {
    const prompt = buildPrompt({
      templateId: 'one_on_one',
      depth: 'standard',
      transcript,
    })
    expect(prompt).toContain('제목을 직접 지어')
  })

  it('raw는 구조적 제목을 덧붙이지 말라는 지시를 유지한다', () => {
    const prompt = buildPrompt({
      templateId: 'raw',
      depth: 'detailed',
      transcript,
    })
    expect(prompt).toContain('구조적 제목(## 섹션)을 덧붙이지 마세요')
  })
})

describe('액션 아이템 담당자 표기', () => {
  const transcript = '다음 주까지 정리해 주세요'

  it('담당자 표기를 요구한다', () => {
    const prompt = buildPrompt({
      templateId: 'meeting',
      depth: 'standard',
      transcript,
    })
    expect(prompt).toContain('(담당자)')
  })

  it('담당자가 불분명해도 항목을 버리지 않도록 지시한다', () => {
    const prompt = buildPrompt({
      templateId: 'meeting',
      depth: 'standard',
      transcript,
    })
    expect(prompt).toContain('담당자가 불분명해도')
  })

  it('체크박스 형식을 유지해 액션 아이템 파서와 호환된다', () => {
    for (const id of ['meeting', 'one_on_one', 'brainstorm'] as const) {
      const prompt = buildPrompt({ templateId: id, depth: 'standard', transcript })
      expect(prompt).toContain('- [ ]')
    }
  })
})

describe('공통 규칙', () => {
  const transcript = '테스트 발화'

  it('프리셋 템플릿 전체에 공통 규칙이 붙는다', () => {
    for (const id of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]) {
      const prompt = buildPrompt({ templateId: id, depth: 'standard', transcript })
      expect(prompt).toContain('지어내지 마세요')
      expect(prompt).toContain('한국어로 작성하세요')
    }
  })

  it('발화자 표기가 있으면 활용하도록 지시한다', () => {
    const prompt = buildPrompt({
      templateId: 'meeting',
      depth: 'standard',
      transcript,
    })
    expect(prompt).toContain('발화자 표기가 있다면')
  })

  it('영어 기술 용어는 원문 표기를 유지하도록 지시한다', () => {
    const prompt = buildPrompt({
      templateId: 'meeting',
      depth: 'standard',
      transcript,
    })
    expect(prompt).toContain('원문 표기를 유지하세요')
  })

  it('custom 프롬프트에는 공통 규칙을 덧붙이지 않는다', () => {
    const prompt = buildPrompt({
      templateId: 'custom',
      depth: 'standard',
      transcript,
      customPrompt: '한 줄로만 요약해줘',
    })
    expect(prompt).toContain('한 줄로만 요약해줘')
    expect(prompt).not.toContain('지어내지 마세요')
  })

  it('custom 프롬프트가 비어 있으면 meeting 템플릿 + 공통 규칙으로 대체한다', () => {
    const prompt = buildPrompt({
      templateId: 'custom',
      depth: 'standard',
      transcript,
      customPrompt: '   ',
    })
    expect(prompt).toContain('회의록 작성 전문가')
    expect(prompt).toContain('지어내지 마세요')
    // 기존 동작 유지 — custom 경로에는 강도/라이브 모디파이어를 적용하지 않는다
    expect(prompt).not.toContain('작성 강도')
  })
})
