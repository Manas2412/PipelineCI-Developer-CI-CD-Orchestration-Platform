import "dotenv/config";
import { PrismaClient } from "./generated/prisma";

declare global {
    var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  console.log('Initializing Prisma with DATABASE_URL:', process.env.DATABASE_URL);
  return new PrismaClient();
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export * from "./generated/prisma";
export default prisma;