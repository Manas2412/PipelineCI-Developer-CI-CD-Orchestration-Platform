import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from 'zod'
import crypto from "node:crypto"
import { redis, Keys } from 'redis'
import { prisma } from "db";

// ─────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  repoUrl: z.string().url().optional(),
  description: z.string().optional(),
  orgId: z.string().uuid()
})

export async function projectsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  //GET /api/projects?orgId=xxx
  app.get('/', async (req, reply) => {
    const { orgId } = req.query as { orgId: string }

    if (!orgId) {
      return reply.status(400).send({
        success: false,
        error: 'orgId required'
      })
    }

    const projects = await prisma.project.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { pipelines: true, runs: true } }
      }
    })

    return reply.send({ success: true, data: projects })
  })


  //GET /api/projects/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const project = await prisma.project.findFirstOrThrow({
      where: { id },
      include: {
        pipelines: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          include: {
            runs: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: { id: true, status: true, createdAt: true, finishedAt: true }
            }
          }
        }
      }
    })

    return reply.send({
      success: true,
      data: project
    })
  })


  //POST /api/projects
  app.post('/', async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const body = createProjectSchema.parse(req.body)

    const webhookSecret = crypto.randomBytes(32).toString('hex')

    const project = await prisma.project.create({
      data: { ...body, webhookSecret }
    })

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'project.created',
        resourceId: project.id,
        resourceType: 'Project',
        metadata: { name: project.name }
      }
    })

    return reply.status(200).send({
      success: true,
      data: project
    })
  })


  //DELETE /api/projects/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { userId } = req.user as { userId: string }

    await prisma.project.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'project.delete',
        resourceId: id,
        resourceType: 'Project',
        metadata: { projectId: id }
      }
    })

    return reply.send({
      success: true
    })
  })


  //POST /api/projects/:id/webhook -- GitHub/GitLab webhook receiver
  app.post('/:id/webhook', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const project = await prisma.project.findUniqueOrThrow({
      where: { id }
    })

    //Verify signature
    const sig = req.headers['x-hub-signature-256'] as string | undefined
    const body = (req as unknown as { rawBody: Buffer }).rawBody

    if (sig && body) {
      const expected = `sha256=${crypto
        .createHmac('sha256', project.webhookSecret)
        .update(body)
        .digest('hex')}`

      const sigBuffer = Buffer.from(sig)
      const expectedBuffer = Buffer.from(expected)

      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return reply.status(401).send({ error: 'Invalid signature' })
      }
    }

    const payload = req.body as Record<string, unknown>
    const eventType = req.headers['x-github-event'] as string ?? 'push'
    const commitSha = (payload?.after as string) ?? undefined
    const branch = ((payload?.ref as string) ?? '').replace('refs/heads/', '')

    //store the raw event
    const event = await prisma.webHookEvent.create({
      data: {
        source: 'github',
        eventType,
        payload: payload as object,
        signature: sig,
        projectId: id
      }
    })

    //Find matching active pipelines
    const pipelines = await prisma.pipeline.findMany({
      where: {
        projectId: id,
        isActive: true,
        trigger: eventType === 'push' ? 'PUSH' : 'PULL_REQUEST',
        OR: [
          { branch: null },
          { branch }
        ]
      }
    })

    for (const pipeline of pipelines) {
      //Important and reuse run creation logic
      await import('./runs').then(async ({ runsRoutes: _ }) => {
        //Inline: create run + kickoff
        const { parsePipelineYaml, buildDag } = await import('../lib/dag')
        const { kickOffRun } = await import('../lib/scheduler')
        const { RunStatus } = await import('db')

        const def = parsePipelineYaml(pipeline.yamlConfig)
        const graph = buildDag(def)

        const run = await prisma.$transaction(async (tx) => {
          const newRun = await tx.run.create({
            data: {
              pipelineId: pipeline.id,
              projectId: id,
              status: RunStatus.PENDING,
              triggerSha: 'PUSH',
              triggeredBy: 'webhook',
              commitSha,
              branch
            }
          })

          await tx.stepRun.createMany({
            data: def.steps.map((step) => ({
              runId: newRun.id,
              name: step.name,
              status: RunStatus.PENDING,
              image: step.image,
              commands: step.commands
            }))
          })

          return newRun
        })

        //Kickoff
        await kickOffRun(run.id)
      })
    }

    await prisma.webHookEvent.update({
      where: { id: event.id },
      data: { status: pipelines.length > 0 ? 'PROCESSED' : 'IGNORED', processedAt: new Date() },
    })
    return reply.send({ success: true, triggeredRuns: pipelines.length })
  })
}



// ─────────────────────────────────────────────────────────────
// Runners
// ─────────────────────────────────────────────────────────────

export async function runnersRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  //GET /api/runners -- list all runners with live status from redis
  app.get('/', async (_req, reply) => {
    const runners = await prisma.runner.findMany({
      orderBy: { registeredAt: 'desc' }
    })

    //Check Redis liveness for each runner
    const withStatus = await Promise.all(
      runners.map(async (r) => {
        const alive = await redis.get(Keys.runnerAlive(r.id))
        return { ...r, online: alive === '1' }
      })
    )

    return reply.send({ success: true, data: withStatus })
  })


  //POST /api/runners/register - runner agent calls this on startup
  app.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      label: z.string(),
      capacity: z.number().int().min(1).max(32).default(4),
      hostname: z.string().optional(),
      ipAddress: z.string().optional(),
      version: z.string().optional()
    }).parse(req.body)

    const runner = await prisma.runner.create({
      data: {
        ...body,
        status: 'ONLINE',
        lastHeartbeat: new Date()
      },
    })

    //Set heartbeat key
    await redis.set(Keys.runnerAlive(runner.id), '1', 'EX', 30)

    await reply.status(201).send({
      success: true,
      data: { runnerId: runner.id }
    })
  })


  //POST /api/runners/:id/heartbeat
  app.post('/:id/heartbeat', async (req, reply) => {
    const { id } = req.params as { id: string }

    await Promise.all([
      redis.set(Keys.runnerAlive(id), '1', 'EX', 30),
      prisma.runner.update({
        where: { id },
        data: { lastHeartbeat: new Date(), status: 'ONLINE' }
      })
    ])

    return reply.send({ success: true })
  })
}
