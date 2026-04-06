import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { authRoutes } from './routes/auth'

const app = Fastify({
  logger: true
})

// Register JWT
app.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret'
})

// Register routes
app.register(authRoutes, { prefix: '/api/auth' })

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
