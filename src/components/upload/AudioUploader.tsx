'use client'

import { useState, useRef, type DragEvent } from 'react'
import { validateAudioFile } from '@/lib/audio-validation'

interface AudioUploaderProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
}

export function AudioUploader({ onFileSelected, disabled }: AudioUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const result = validateAudioFile(file)
    if (!result.valid) {
      setError(result.error)
      return
    }
    setError(null)
    onFileSelected(file)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(true)
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-12
          text-center transition-all duration-200
          ${dragOver
            ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
            : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50/50'
          }
          ${disabled ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <div className="space-y-3">
          <div className="text-4xl">🎙️</div>
          <p className="text-lg font-medium text-neutral-700">
            오디오 파일을 드래그하거나 클릭하여 업로드
          </p>
          <p className="text-sm text-neutral-500">
            MP3, WAV, WebM, M4A, OGG, FLAC (최대 500MB)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
