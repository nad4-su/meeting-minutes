import { DEFAULT_GEMINI_MODEL } from './gemini'
import type { ProviderId } from './types'

export interface ProviderPreset {
  id: string
  label: string
  provider: ProviderId
  /** openai-compatible 프리셋의 기본 base URL. 사용자가 수정할 수 있다. */
  baseUrl: string
  defaultModel: string
  description: string
  apiKeyLabel: string
  apiKeyPlaceholder: string
  /** 키 없이도 동작하는 엔드포인트(로컬 모델 서버)인지 여부 */
  apiKeyOptional?: boolean
  docsUrl?: string
  docsLabel?: string
  modelHint?: string
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    provider: 'gemini',
    baseUrl: '',
    defaultModel: DEFAULT_GEMINI_MODEL,
    description: 'Google에 직접 호출합니다. 무료 티어가 있어 가장 간단합니다.',
    apiKeyLabel: 'Gemini API 키',
    apiKeyPlaceholder: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/apikey',
    docsLabel: 'Google AI Studio',
    modelHint:
      '예: gemini-3.5-flash-lite(저렴·빠름), gemini-3.6-flash, gemini-2.5-pro',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    description: 'OpenAI Chat Completions API를 사용합니다.',
    apiKeyLabel: 'OpenAI API 키',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    docsLabel: 'OpenAI 대시보드',
    modelHint: '예: gpt-4o-mini, gpt-4o',
  },
  {
    id: 'orcarouter',
    label: 'OrcaRouter',
    provider: 'openai-compatible',
    baseUrl: 'https://api.orcarouter.ai/v1',
    defaultModel: 'google/gemini-3.5-flash-lite',
    description:
      '하나의 키로 여러 제공사 모델을 사용합니다. 별도 가입과 크레딧 충전(또는 BYOK 등록)이 필요합니다.',
    apiKeyLabel: 'OrcaRouter API 키',
    apiKeyPlaceholder: 'sk-...',
    docsUrl: 'https://www.orcarouter.ai/',
    docsLabel: 'OrcaRouter',
    modelHint:
      '예: google/gemini-3.5-flash-lite, openai/gpt-4o-mini, orcarouter/auto',
  },
  {
    id: 'local',
    label: '로컬 모델',
    provider: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    description:
      'Ollama · LM Studio · vLLM 등 내 PC에서 도는 모델. 회의 내용이 외부로 나가지 않습니다.',
    apiKeyLabel: 'API 키 (보통 불필요)',
    apiKeyPlaceholder: '비워두세요',
    apiKeyOptional: true,
    modelHint: 'Ollama 기본 포트는 11434, LM Studio는 1234입니다.',
  },
  {
    id: 'custom',
    label: '직접 입력',
    provider: 'openai-compatible',
    baseUrl: '',
    defaultModel: '',
    description: 'OpenAI 호환 엔드포인트라면 무엇이든 연결할 수 있습니다.',
    apiKeyLabel: 'API 키',
    apiKeyPlaceholder: 'sk-...',
    apiKeyOptional: true,
    modelHint: '엔드포인트가 제공하는 모델 ID를 그대로 입력하세요.',
  },
]

export const DEFAULT_PRESET_ID = 'gemini'

export function findPreset(presetId: string | null | undefined): ProviderPreset {
  return (
    PROVIDER_PRESETS.find((preset) => preset.id === presetId) ??
    PROVIDER_PRESETS[0]
  )
}
