import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { prisma, TriggerType } from 'db'
import { parsePipelineYaml, buildDag, topoSort } from '../lib/dag'

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  yamlConfig: z.string().min(1),
  trigger: z.nativeEnum(TriggerType),
  branch: z.string().optional(),
  cronExpr: z.string().optional(),
  projectId: z.string().uuid()
})

const updateSchema = createSchema.partial().omit({ projectId: true })

export async function pipelineRoutes(app: FastifyInstance) {
  // All pipeline routes require auth
  // Ensure authenticate is registered on the app instance
  app.addHook('preHandler', async (req, reply) => {
    try {
      await app.authenticate(req, reply);
    } catch (err) {
      reply.send(err);
    }
  });

  // GET /api/pipelines?projectId=xxx
  app.get('/', async (req, reply) => {
    const { projectId } = req.query as { projectId?: string }
    if (!projectId) {
      return reply.status(400).send({
        success: false,
        error: 'projectId required'
      })
    }

    const pipelines = await prisma.pipeline.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { runs: true } }
      }
    })

    return reply.send({
      success: true,
      data: pipelines
    })
  })

  // GET /api/pipelines/:id
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const pipeline = await prisma.pipeline.findUniqueOrThrow({
      where: { id }
    })
    return reply.status(200).send({
      success: true,
      data: pipeline
    })
  })

  // POST /api/pipelines
  app.post('/', async (req, reply) => {
    const body = createSchema.parse(req.body)

    // Validate YAML before saving
    const def = parsePipelineYaml(body.yamlConfig) // throws if invalid
    buildDag(def) // throws if cycle

    const pipeline = await prisma.pipeline.create({
      data: body
    })

    return reply.status(201).send({
      success: true,
      data: pipeline
    })
  })

  // PATCH /api/pipelines/:id
  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = updateSchema.parse(req.body)

    if (body.yamlConfig) {
      const def = parsePipelineYaml(body.yamlConfig)
      buildDag(def)
    }

    const pipeline = await prisma.pipeline.update({
      where: { id },
      data: body
    })
    return reply.send({
      success: true,
      data: pipeline
    })
  })

  // DELETE /api/pipelines/:id
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    await prisma.pipeline.update({
      where: { id },
      data: { isActive: false }
    })

    return reply.send({
      success: true,
      message: 'Pipeline deactivated'
    })
  })

  // POST /api/pipelines/validate - parse YAML and return the DAG
  app.post('/:id/validate', async (req, reply) => {
    const body = z.object({ yamlConfig: z.string() }).parse(req.body)

    try {
      const def = parsePipelineYaml(body.yamlConfig)
      const graph = buildDag(def)
      const layers = topoSort(graph)

      return reply.send({
        success: true,
        data: {
          valid: true,
          pipelineName: def.name,
          stepCount: def.steps.length,
          layers,
          graph
        }
      })
    } catch (err) {
      return reply.send({
        success: false,
        data: {
          valid: false,
          error: (err as Error).message
        }
      })
    }
  })
}
