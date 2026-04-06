import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { authRoutes } from './routes/auth'
import { pipelineRoutes } from './routes/pipeline'
import { runsRoutes } from './routes/runs'

const app = Fastify({
  logger: true
})

// Register JWT
app.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret'
})

// Decorate app with authenticate hook
app.decorate("authenticate", async (request: any, reply: any) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.send(err)
  }
})

// Register routes
app.register(authRoutes, { prefix: '/api/auth' })
app.register(pipelineRoutes, { prefix: '/api/pipelines' })
app.register(runsRoutes, { prefix: '/api/runs' })

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' })
    console.log('Server listening on http://localhost:3001')
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
