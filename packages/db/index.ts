import { PrismaClient } from "@prisma/client/extension";

declare global {
    var __prisma: PrismaClient | undefined
}

function createPrismaClient() {
    return new PrismaClient({
        log: 
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error']
    })
}

export const prisma : PrismaClient = globalThis.__prisma ?? createPrismaClient()

if(process.env.NODE_ENV !== 'production'){
    globalThis.__prisma == prisma
}

export * from '@prisma/client'
export default prisma