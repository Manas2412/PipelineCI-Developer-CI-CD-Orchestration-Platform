import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, RunStatus, TriggerType } from "db";
import { parsePipelineYaml, buildDag } from "../lib/dag";
import { kickOffRun } from "../lib/scheduler";
import { setCancelFlag } from "../lib/queue";

const triggerSchema = z.object({
    pipelineId: z.string().uuid(),
    commitSha: z.string().optional(),
    commitMsg: z.string().optional(),
    branch: z.string().optional()
})

export async function runsRoutes(app: FastifyInstance) {
    // All run routes require auth
    app.addHook('preHandler', async (req, reply) => {
        try {
            await app.authenticate(req, reply)
        } catch (err) {
            reply.send(err)
        }
    })

    //GET api/runs?pipelineId=xxx&page=1&pageSize=20
    app.get('/', async (req, reply) => {
        const { pipelineId, projectId, page = '1', pageSize = '20' } = req.query as Record<string, string>

        const skip = (Number(page) - 1) * Number(pageSize)
        const where = {
            ...(pipelineId ? { pipelineId } : {}),
            ...(projectId ? { projectId } : {}),
        }

        const [runs, total] = await Promise.all([
            prisma.run.findMany({
                where,
                skip,
                take: Number(pageSize),
                orderBy: { createdAt: 'desc' },
                include: {
                    pipeline: { select: { id: true, name: true } },
                    stepRuns: {
                        select: { id: true, name: true, status: true, startedAt: true, finishedAt: true },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            }),
            prisma.run.count({ where }),
        ])

        return reply.send({
            success: true,
            data: {
                data: runs,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                hasMore: skip + runs.length < total
            }
        })
    })


    // GET api/runs/:id
    app.get('/:id', async (req, reply) => {
        const { id } = req.params as { id: string }

        const run = await prisma.run.findUniqueOrThrow({
            where: { id },
            include: {
                pipeline: { select: { id: true, name: true, yamlConfig: true } },
                stepRuns: {
                    orderBy: { createdAt: 'desc' },
                    include: { _count: { select: { logChunks: true } } }
                },
                artifacts: true,
            }
        })

        //Also returns the DAG graph so the prontend can render it
        const def = parsePipelineYaml(run.pipeline.yamlConfig)
        const graph = buildDag(def)

        return reply.send({
            success: true,
            data: { ...run, graph }
        })
    })


    // POST /api/runs == trigger a run manually
    app.post('/', async (req, reply) => {
        const { userId } = req.user as { userId: string }
        const body = triggerSchema.parse(req.body)

        const pipeline = await prisma.pipeline.findUniqueOrThrow({
            where: { id: body.pipelineId }
        })

        //Parse YAML to get step definitions
        const def = parsePipelineYaml(pipeline.yamlConfig)
        const graph = buildDag(def)

        //Create the Run + all StepRun records in onr transaction
        const run = await prisma.$transaction(async (tx) => {
            const newRun = await tx.run.create({
                data: {
                    pipelineId: body.pipelineId,
                    projectId: pipeline.projectId,
                    status: RunStatus.QUEUED,
                    triggerType: TriggerType.MANUAL,
                    triggeredBy: userId,
                    commitSha: body.commitSha,
                    commitMsg: body.commitMsg,
                    branch: body.branch,
                },
            })
            //Create a StepRun for each step in the DAG
            await tx.stepRun.createMany({
                data: def.steps.map((step) => ({
                    runId: newRun.id,
                    name: step.name,
                    status: RunStatus.PENDING,
                    image: step.image,
                    commands: step.commands
                }))
            })

            //Wire up the DAG self-relations
            const createdSteps = await tx.stepRun.findMany({
                where: { runId: newRun.id },
                select: { id: true, name: true }
            })

            const nameToId = Object.fromEntries(createdSteps.map((s) => [s.name, s.id]))

            for (const step of def.steps) {
                if (!step.dependsOn || step.dependsOn.length === 0)
                    continue

                await tx.stepRun.update({
                    where: { id: nameToId[step.name] },
                    data: {
                        dependsOn: {
                            connect: step.dependsOn.map((dep) => ({ id: nameToId[dep] }))
                        }
                    }
                })
            }
            return newRun
        })

        //Kick off the run outside the transaction
        await kickOffRun(run.id)

        //Audit log
        await prisma.auditLog.create({
            data: {
                actorId: userId,
                action: 'run.created',
                resourceId: run.id,
                resourceType: 'Run',
                metadata: { pipelineId: pipeline.id, trigger: 'MANUAL' }
            }
        })

        return reply.status(201).send({
            success: true,
            data: { runId: run.id }
        })
    })


    //POST /api/runs/:id/cancel
    app.post('/:id/cancel', async (req, reply) => {
        const { id } = req.params as { id: string }
        const { userId } = req.user as { userId: string }

        const run = await prisma.run.findUniqueOrThrow({
            where: { id }
        })

        if (!['PENDING', 'QUEUED', 'RUNNING'].includes(run.status)) {
            return reply.status(400).send({
                success: false,
                error: 'Run is not in a cancelable state'
            })
        }

        //Set the Redis cancel flag -- the runner polls this
        await setCancelFlag(id)

        //Optimistically mark as CANCELLED in DB
        await prisma.run.update({
            where: { id },
            data: {
                status: RunStatus.CANCELLED,
                finishedAt: new Date()
            }
        })

        await prisma.auditLog.create({
            data: {
                actorId: userId,
                action: 'run.cancelled',
                resourceId: id,
                resourceType: 'Run',
                metadata: { pipelineId: run.pipelineId }
            }
        })

        return reply.send({
            success: true,
            message: 'Run cancellation requested'
        })
    })

    //GET /api/runs/:id/stats == for Gantt data

    app.get('/:id/stats', async (req, reply) => {
        const { id } = req.params as { id: string }

        const run = await prisma.run.findFirstOrThrow({
            where: { id },
            include: {
                stepRuns: {
                    orderBy: { startedAt: 'asc' },
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        image: true,
                        startedAt: true,
                        finishedAt: true,
                        exitCode: true,
                        runnerId: true
                    }
                }
            }
        })

        //Calculate durations for Gantt
        const refTime = run.startedAt?.getTime() ?? Date.now()
        const steps = run.stepRuns.map((s) => ({
            ...s,
            offsetMs: s.startedAt ? s.startedAt.getTime() - refTime : null,
            durationMs: s.startedAt && s.finishedAt ?
                s.finishedAt.getTime() - s.startedAt.getTime() : null,
        }))

        return reply.send({
            success: true,
            data: { run, steps }
        })
    })
}