import path from 'node:path'
import { existsSync } from 'node:fs'

/**
 * 로컬 화자 분리 (speaker diarization).
 *
 * pyannote-segmentation-3.0 + 3D-Speaker 임베딩을 ONNX Runtime으로 돌린다.
 * GPU도 파이썬 런타임도 필요 없고, 노트북 CPU에서 실시간의 수십 배 속도로 처리된다.
 *
 * 마이크 하나에 여러 사람이 섞여 들어오는 대면 회의용 경로다. 원격 회의처럼
 * 트랙이 이미 나뉘어 있으면 이 모듈을 쓰지 않는 편이 정확하다.
 */

export interface SpeakerSegment {
  /** 발화 시작 (초) */
  start: number
  /** 발화 종료 (초) */
  end: number
  /** 0부터 시작하는 화자 번호 */
  speaker: number
}

export type DiarizationResult =
  | { success: true; segments: SpeakerSegment[] }
  | { success: false; error: string; reason: 'models-missing' | 'failed' }

export interface DiarizeOptions {
  /**
   * 참석자 수. 알면 반드시 넘길 것.
   *
   * 자동 추정은 화자 수를 과다·과소 계수하는 것이 주 실패 모드다.
   * 실측에서 4인 오디오가 자동 모드로는 5명, 힌트를 주면 4명으로 나왔다.
   */
  numSpeakers?: number
  /** 자동 추정 시 클러스터 분리 임계값. 낮을수록 화자를 많이 잡는다. */
  threshold?: number
}

const MODEL_DIR = process.env.DIARIZATION_MODEL_DIR ?? 'models/diarization'
const SEGMENTATION_MODEL = 'segmentation.onnx'
const EMBEDDING_MODEL = 'embedding.onnx'

export function resolveModelPaths(): {
  segmentation: string
  embedding: string
} {
  const root = path.isAbsolute(MODEL_DIR)
    ? MODEL_DIR
    : path.join(process.cwd(), MODEL_DIR)

  return {
    segmentation: path.join(root, SEGMENTATION_MODEL),
    embedding: path.join(root, EMBEDDING_MODEL),
  }
}

export function modelsInstalled(): boolean {
  const { segmentation, embedding } = resolveModelPaths()
  return existsSync(segmentation) && existsSync(embedding)
}

/**
 * 모델 로딩이 수백 ms 걸리므로 프로세스당 한 번만 만들고 재사용한다.
 * 클러스터링 설정은 요청마다 바뀔 수 있어 setConfig로 갈아끼운다.
 */
type Diarizer = {
  process: (samples: Float32Array) => SpeakerSegment[]
  setConfig: (config: {
    clustering: { numClusters?: number; threshold?: number }
  }) => void
}

let cached: Diarizer | null = null

async function getDiarizer(): Promise<Diarizer> {
  if (cached) return cached

  const { segmentation, embedding } = resolveModelPaths()
  const { OfflineSpeakerDiarization } = await import('sherpa-onnx-node')

  cached = new OfflineSpeakerDiarization({
    segmentation: {
      pyannote: { model: segmentation },
      numThreads: 2,
    },
    embedding: { model: embedding, numThreads: 2 },
    clustering: { threshold: 0.5 },
  }) as unknown as Diarizer

  return cached
}

export async function diarize(
  samples: Float32Array,
  options: DiarizeOptions = {},
): Promise<DiarizationResult> {
  if (samples.length === 0) {
    return { success: true, segments: [] }
  }

  if (!modelsInstalled()) {
    return {
      success: false,
      reason: 'models-missing',
      error:
        '화자 분리 모델이 설치되지 않았습니다. `npm run setup:diarization`을 실행해주세요.',
    }
  }

  try {
    const diarizer = await getDiarizer()

    // 참석자 수를 알면 클러스터 개수를 고정한다. 정확도가 크게 오른다.
    diarizer.setConfig({
      clustering:
        options.numSpeakers && options.numSpeakers > 0
          ? { numClusters: options.numSpeakers }
          : { threshold: options.threshold ?? 0.5 },
    })

    const segments = diarizer.process(samples)

    return {
      success: true,
      segments: segments.map((s) => ({
        start: s.start,
        end: s.end,
        speaker: s.speaker,
      })),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return { success: false, reason: 'failed', error: `화자 분리 실패: ${message}` }
  }
}
