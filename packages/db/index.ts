import "dotenv/config";
import { PrismaClient } from "./generated/prisma";

declare global {
    var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient();
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export * from "./generated/prisma";
export default prisma;