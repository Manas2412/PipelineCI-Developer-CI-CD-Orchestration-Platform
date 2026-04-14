import { PrismaClient } from '../packages/db/generated'
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const newYaml = `name: My Pipeline

steps:
  - name: install
    image: oven/bun:1-alpine
    commands:
      - bun install --frozen-lockfile

  - name: test
    image: oven/bun:1-alpine
    dependsOn: [install]
    commands:
      - bun test

  - name: build
    image: oven/bun:1-alpine
    dependsOn: [test]
    commands:
      - bun run build
`

async function main() {
  const pipelineId = '06ef098b-69ae-4240-bd86-6a1a6d95aa42'
  
  console.log(`Updating pipeline ${pipelineId}...`)
  
  await prisma.pipeline.update({
    where: { id: pipelineId },
    data: { yamlConfig: newYaml }
  })
  
  console.log('Pipeline updated successfully!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
