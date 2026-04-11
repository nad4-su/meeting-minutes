import { NextRequest } from 'next/server'
import { handleUpload } from '@/lib/upload-handler'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const result = await handleUpload(formData)

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 })
    }

    const audioFile = formData.get('audio') as File
    const buffer = Buffer.from(await audioFile.arrayBuffer())

    await mkdir(UPLOAD_DIR, { recursive: true })

    const timestamp = Date.now()
    const safeFileName = `${timestamp}_${result.data.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filePath = path.join(UPLOAD_DIR, safeFileName)

    await writeFile(filePath, buffer)

    return Response.json({
      ...result.data,
      savedAs: safeFileName,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json({ error: `업로드 처리 실패: ${message}` }, { status: 500 })
  }
}
