/**
 * 마이크 오디오를 Int16 PCM 조각으로 잘라 메인 스레드로 넘긴다.
 *
 * AudioContext를 16kHz로 열면 브라우저가 리샘플링해주므로 여기서는
 * float32 → int16 변환과 버퍼링만 한다. 화자 분리 모델이 16kHz 모노를 받는다.
 */
const CHUNK_SAMPLES = 16000 * 4 // 4초

class PcmCollector extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = new Int16Array(CHUNK_SAMPLES)
    this.offset = 0
  }

  flush() {
    if (this.offset === 0) return
    const out = this.buffer.slice(0, this.offset)
    this.port.postMessage(out, [out.buffer])
    this.buffer = new Int16Array(CHUNK_SAMPLES)
    this.offset = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) return true

    for (let i = 0; i < channel.length; i++) {
      const clamped = Math.max(-1, Math.min(1, channel[i]))
      this.buffer[this.offset++] = clamped * 32767
      if (this.offset === CHUNK_SAMPLES) this.flush()
    }

    return true
  }
}

registerProcessor('pcm-collector', PcmCollector)
