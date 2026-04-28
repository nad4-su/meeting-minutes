import { describe, it, expect, beforeEach, vi } from 'vitest'

const findManyMock = vi.fn()
const countMock = vi.fn()
const createMock = vi.fn()
const findUniqueMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    meeting: {
      findMany: findManyMock,
      count: countMock,
      create: createMock,
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
    },
  },
}))

const { GET: listGet, POST: listPost } = await import(
  '@/app/api/meetings/route'
)
const {
  GET: detailGet,
  PUT: detailPut,
  DELETE: detailDelete,
} = await import('@/app/api/meetings/[id]/route')

function makeRequest(url = 'http://localhost/api/meetings', init?: RequestInit) {
  return new Request(url, init) as unknown as Parameters<typeof listGet>[0]
}

beforeEach(() => {
  findManyMock.mockReset()
  countMock.mockReset()
  createMock.mockReset()
  findUniqueMock.mockReset()
  updateMock.mockReset()
  deleteMock.mockReset()
})

describe('GET /api/meetings (list)', () => {
  it('기본 파라미터로 목록과 total을 반환한다', async () => {
    findManyMock.mockResolvedValue([{ id: 'a', title: '회의 1' }])
    countMock.mockResolvedValue(1)

    const res = await listGet(makeRequest('http://localhost/api/meetings'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.meetings).toHaveLength(1)
    expect(data.total).toBe(1)
    expect(data.limit).toBe(20)
    expect(data.offset).toBe(0)
  })

  it('q 파라미터가 있으면 검색 조건이 적용된다', async () => {
    findManyMock.mockResolvedValue([])
    countMock.mockResolvedValue(0)

    await listGet(makeRequest('http://localhost/api/meetings?q=sprint'))

    const call = findManyMock.mock.calls[0][0]
    expect(call.where.OR).toBeDefined()
    expect(call.where.OR[0].title.contains).toBe('sprint')
  })

  it('limit 상한(100)을 초과하면 잘린다', async () => {
    findManyMock.mockResolvedValue([])
    countMock.mockResolvedValue(0)

    const res = await listGet(
      makeRequest('http://localhost/api/meetings?limit=500'),
    )
    const data = await res.json()
    expect(data.limit).toBe(100)
  })
})

describe('POST /api/meetings (create)', () => {
  it('유효한 입력으로 회의록을 생성한다', async () => {
    createMock.mockResolvedValue({ id: 'new-id', title: '새 회의' })

    const res = await listPost(
      makeRequest('http://localhost/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: '새 회의',
          markdownMinutes: '# 내용',
          template: 'meeting',
          depth: 'standard',
          attendees: ['Alice'],
          tags: ['sprint'],
        }),
      }),
    )

    const data = await res.json()
    expect(res.status).toBe(201)
    expect(data.id).toBe('new-id')
    expect(createMock).toHaveBeenCalledOnce()
  })

  it('제목이 없으면 400을 반환한다', async () => {
    const res = await listPost(
      makeRequest('http://localhost/api/meetings', {
        method: 'POST',
        body: JSON.stringify({ markdownMinutes: '# 내용' }),
      }),
    )
    expect(res.status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('본문이 없으면 400을 반환한다', async () => {
    const res = await listPost(
      makeRequest('http://localhost/api/meetings', {
        method: 'POST',
        body: JSON.stringify({ title: '제목만' }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('attendees/tags가 배열이 아니면 빈 배열로 정규화한다', async () => {
    createMock.mockResolvedValue({ id: 'x' })

    await listPost(
      makeRequest('http://localhost/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: 'A',
          markdownMinutes: '# B',
          attendees: 'not-array',
          tags: 42,
        }),
      }),
    )

    const call = createMock.mock.calls[0][0]
    expect(call.data.attendees).toEqual([])
    expect(call.data.tags).toEqual([])
  })
})

describe('GET /api/meetings/[id]', () => {
  it('존재하면 200과 본문을 반환한다', async () => {
    findUniqueMock.mockResolvedValue({ id: 'abc', title: '존재' })

    const res = await detailGet(
      makeRequest('http://localhost/api/meetings/abc'),
      { params: Promise.resolve({ id: 'abc' }) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('abc')
  })

  it('없으면 404를 반환한다', async () => {
    findUniqueMock.mockResolvedValue(null)
    const res = await detailGet(
      makeRequest('http://localhost/api/meetings/none'),
      { params: Promise.resolve({ id: 'none' }) },
    )
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/meetings/[id]', () => {
  it('markdownMinutes만 수정할 수 있다', async () => {
    updateMock.mockResolvedValue({ id: 'abc', markdownMinutes: '수정됨' })
    const res = await detailPut(
      makeRequest('http://localhost/api/meetings/abc', {
        method: 'PUT',
        body: JSON.stringify({ markdownMinutes: '수정됨' }),
      }),
      { params: Promise.resolve({ id: 'abc' }) },
    )
    expect(res.status).toBe(200)
    const call = updateMock.mock.calls[0][0]
    expect(call.data).toEqual({ markdownMinutes: '수정됨' })
  })

  it('수정할 필드가 없으면 400을 반환한다', async () => {
    const res = await detailPut(
      makeRequest('http://localhost/api/meetings/abc', {
        method: 'PUT',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'abc' }) },
    )
    expect(res.status).toBe(400)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('없는 id면 404를 반환한다', async () => {
    updateMock.mockRejectedValue(new Error('Record not found'))
    const res = await detailPut(
      makeRequest('http://localhost/api/meetings/none', {
        method: 'PUT',
        body: JSON.stringify({ title: '새 제목' }),
      }),
      { params: Promise.resolve({ id: 'none' }) },
    )
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/meetings/[id]', () => {
  it('성공 시 204를 반환한다', async () => {
    deleteMock.mockResolvedValue({ id: 'abc' })
    const res = await detailDelete(
      makeRequest('http://localhost/api/meetings/abc', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'abc' }) },
    )
    expect(res.status).toBe(204)
  })

  it('없으면 404를 반환한다', async () => {
    deleteMock.mockRejectedValue(new Error('Record not found'))
    const res = await detailDelete(
      makeRequest('http://localhost/api/meetings/none', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'none' }) },
    )
    expect(res.status).toBe(404)
  })
})
