import { PrismaClient } from '../packages/db/generated'
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const runId = '863e15c9-e08a-41ce-bb30-dfc7156e7569'
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      project: true,
      pipeline: true,
      stepRuns: {
        include: { logChunks: { orderBy: { createdAt: 'asc' } } }
      }
    }
  })

  if (!run) {
    console.log('Run not found')
    return
  }

  console.log(`Run: ${run.id} (${run.status})`)
  console.log(`Pipeline ID: ${run.pipeline.id}`)
  console.log(`Triggered By: ${run.triggeredBy}`)
  console.log(`Project: ${run.project.name} (Repo: ${run.project.repoUrl})`)
  console.log(`YAML Config:\n${run.pipeline.yamlConfig}\n`)
  for (const step of run.stepRuns) {
    console.log(`\nStep: ${step.name} (${step.status}, exitCode: ${step.exitCode})`)
    const fullLog = step.logChunks.map(c => (c as any).text).join('\n')
    console.log('--- Logs ---')
    console.log(fullLog)
    console.log('------------')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
