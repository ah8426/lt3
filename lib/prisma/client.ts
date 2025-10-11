import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Connection pool configuration
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

// Named export for consistency
export { prisma }

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
