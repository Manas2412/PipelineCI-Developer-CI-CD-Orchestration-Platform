import { PrismaClient } from "./generated/prisma/client.ts";

declare global {
    var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL ?? "",
  });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export * from "./generated/prisma/client.ts";
export default prisma;