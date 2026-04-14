import { PrismaClient, RunStatus } from '../packages/db/generated'
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import yaml from "js-yaml";
import { redis } from "../packages/redis";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const pipelineId = '06ef098b-69ae-4240-bd86-6a1a6d95aa42'
  const userId = 'dac18fd4-cf2c-4f09-bdf6-527d9aec18c0'

  console.log(`Triggering new run for pipeline ${pipelineId}...`)

  const pipeline = await prisma.pipeline.findUniqueOrThrow({
    where: { id: pipelineId },
    include: { project: true }
  })

  // Basic YAML parsing (simplified version of parsePipelineYaml)
  const def = yaml.load(pipeline.yamlConfig) as any
  
  const run = await prisma.$transaction(async (tx) => {
    const newRun = await tx.run.create({
      data: {
        pipelineId:  pipeline.id,
        projectId:   pipeline.projectId,
        status:      RunStatus.PENDING,
        triggerType: 'MANUAL',
        triggeredBy: userId,
        branch:      'main', // Default branch
      },
    })

    // Create StepRuns
    await tx.stepRun.createMany({
      data: def.steps.map((step: any) => ({
        runId:    newRun.id,
        name:     step.name,
        status:   RunStatus.PENDING,
        image:    step.image,
        commands: step.commands,
      })),
    })

    // Wire dependencies
    const createdSteps = await tx.stepRun.findMany({
      where: { runId: newRun.id },
      select: { id: true, name: true },
    })
    const nameToId = Object.fromEntries(createdSteps.map((s) => [s.name, s.id]))

    for (const step of def.steps) {
      if (!step.dependsOn || step.dependsOn.length === 0) continue

      await tx.stepRun.update({
        where: { id: nameToId[step.name] },
        data: {
          dependsOn: {
            connect: step.dependsOn.map((dep: string) => ({ id: nameToId[dep] })),
          },
        },
      })
    }
    return newRun
  })

  // Enqueue root steps to Redis
  const rootSteps = def.steps.filter((s: any) => !s.dependsOn || s.dependsOn.length === 0)
  for (const stepDef of rootSteps) {
    const stepRun = await prisma.stepRun.findFirst({
        where: { runId: run.id, name: stepDef.name }
    })
    if (!stepRun) continue

    await redis.xadd(
        'pipeline:jobs',
        '*',
        'runId', run.id,
        'stepRunId', stepRun.id,
        'stepName', stepDef.name,
        'image', stepDef.image,
        'commands', JSON.stringify(stepDef.commands),
        'env', JSON.stringify({}),
        'timeoutSeconds', '600',
        'repoUrl', pipeline.project.repoUrl || '',
        'branch', run.branch || '',
        'commitSha', run.commitSha || '',
    )
    
    await prisma.stepRun.update({
        where: { id: stepRun.id },
        data: { status: RunStatus.QUEUED }
    })
    
    console.log(`Enqueued root step: ${stepDef.name}`)
  }

  console.log(`Run ${run.id} created and jobs enqueued!`)
}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect()
    await redis.quit()
})
