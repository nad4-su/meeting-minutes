#!/usr/bin/env node
/**
 * 화자 분리 모델 내려받기.
 *
 * 두 모델 모두 CPU에서 도는 ONNX 파일이며 GPU나 파이썬 런타임이 필요 없다.
 * 라이선스 문제로 저장소에 포함하지 않고 최초 1회 내려받는다.
 *
 *   npm run setup:diarization
 */
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const DEST = path.join(process.cwd(), 'models', 'diarization')

const MODELS = [
  {
    name: 'segmentation.onnx',
    // pyannote/segmentation-3.0 (MIT) — 발화 구간 분할
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2',
    archiveEntry: 'sherpa-onnx-pyannote-segmentation-3-0/model.onnx',
    approxMB: 6,
  },
  {
    name: 'embedding.onnx',
    // 3D-Speaker CAM++ — 화자 임베딩
    url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_campplus_sv_zh-cn_16k-common.onnx',
    approxMB: 28,
  },
]

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  await pipeline(res.body, createWriteStream(dest))
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} 실패 (exit ${code})`)),
    )
  })
}

async function main() {
  await mkdir(DEST, { recursive: true })

  for (const model of MODELS) {
    const target = path.join(DEST, model.name)

    if (await exists(target)) {
      console.log(`✓ ${model.name} — 이미 있음`)
      continue
    }

    console.log(`↓ ${model.name} (약 ${model.approxMB}MB) 내려받는 중...`)

    if (!model.archiveEntry) {
      await download(model.url, target)
      console.log(`✓ ${model.name}`)
      continue
    }

    const archive = path.join(DEST, 'tmp.tar.bz2')
    await download(model.url, archive)
    await run('tar', ['xjf', archive], DEST)
    await rename(path.join(DEST, model.archiveEntry), target)
    await rm(archive)
    await rm(path.join(DEST, path.dirname(model.archiveEntry)), {
      recursive: true,
      force: true,
    })
    console.log(`✓ ${model.name}`)
  }

  console.log(`\n완료. 모델 위치: ${DEST}`)
  console.log('이제 녹음 화면에서 "대면 회의 화자 분리"를 쓸 수 있습니다.')
}

main().catch((err) => {
  console.error(`\n✗ 실패: ${err.message}`)
  console.error('네트워크를 확인하고 다시 실행해주세요.')
  process.exit(1)
})
