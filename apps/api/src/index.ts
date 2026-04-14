import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
// ... rest of imports
import { authRoutes } from './routes/auth'
import { pipelineRoutes as pipelinesRoutes } from './routes/pipeline'
import { runsRoutes } from './routes/runs'
import { logsRoutes } from './routes/logs'
import { projectsRoutes, runnersRoutes } from './routes/projects'
import { ensureConsumerGroup } from './lib/queue'
import { startScheduler } from './lib/scheduler'


const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
  },
})

// ─────────────────────────────────────────────────────────────
// Plugins
// ─────────────────────────────────────────────────────────────

await app.register(cors, {
  origin: (origin, cb) => {
    const allowed = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://0.0.0.0:3000'];
    if (!origin || allowed.includes(origin) || process.env.NODE_ENV === 'development') {
      cb(null, true);
      return;
    }
    cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
})

// Attach authenticate decorator so routes can use app.authenticate
app.decorate('authenticate', async (req: any, reply: any) => {
  try {
    await req.jwtVerify()
  } catch {
    return reply.status(401).send({ success: false, error: 'Unauthorized' })
  }
})

// Global error handler
app.setErrorHandler((error: any, request, reply) => {
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: error.message
    })
  }

  // Handle Prisma errors
  if (error.code === 'P2025') {
    return reply.status(404).send({
      success: false,
      error: 'Resource not found'
    })
  }

  app.log.error(error)
  reply.status(500).send({
    success: false,
    error: 'Internal Server Error'
  })
})

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(projectsRoutes, { prefix: '/api/projects' })
await app.register(pipelinesRoutes, { prefix: '/api/pipelines' })
await app.register(runsRoutes, { prefix: '/api/runs' })
await app.register(logsRoutes, { prefix: '/api/logs' })
await app.register(runnersRoutes, { prefix: '/api/runners' })

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

async function main() {
  try {
    // Ensure Redis Streams consumer groups exist
    await ensureConsumerGroup()

    // Start the DAG scheduler in the background
    startScheduler().catch((err) => {
      app.log.error('[Scheduler] Fatal error:', err)
      process.exit(1)
    })

    const port = Number(process.env.PORT ?? 3001)
    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`API listening on http://localhost:${port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()