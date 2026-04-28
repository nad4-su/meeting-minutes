import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

const BUILD_PLACEHOLDER =
  'postgresql://placeholder:placeholder@localhost:5432/placeholder'

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString && process.env.NODE_ENV === 'production') {
    console.warn(
      '[db] DATABASE_URL이 설정되지 않았습니다. ' +
        'docker-compose 환경변수 또는 .env 파일을 확인하세요. ' +
        '실제 쿼리는 실패합니다.',
    )
  }

  const adapter = new PrismaPg({
    connectionString: connectionString ?? BUILD_PLACEHOLDER,
  })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
