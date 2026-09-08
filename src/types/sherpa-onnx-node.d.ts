/**
 * sherpa-onnx-node는 JSDoc만 제공하고 .d.ts를 배포하지 않는다.
 * 이 프로젝트가 실제로 쓰는 화자 분리 API만 선언한다.
 */
declare module 'sherpa-onnx-node' {
  export interface SherpaSpeakerSegment {
    start: number
    end: number
    speaker: number
  }

  export interface FastClusteringConfig {
    numClusters?: number
    threshold?: number
  }

  export interface OfflineSpeakerDiarizationConfig {
    segmentation?: {
      pyannote?: { model?: string; windowShiftRatio?: number }
      numThreads?: number
      provider?: string
      debug?: boolean | number
    }
    embedding?: { model?: string; numThreads?: number; provider?: string }
    clustering?: FastClusteringConfig
    minDurationOn?: number
    minDurationOff?: number
  }

  export class OfflineSpeakerDiarization {
    constructor(config: OfflineSpeakerDiarizationConfig)
    readonly sampleRate: number
    process(samples: Float32Array): SherpaSpeakerSegment[]
    setConfig(config: { clustering: FastClusteringConfig }): void
  }
}
