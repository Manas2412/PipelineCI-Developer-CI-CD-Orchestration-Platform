import '@fastify/jwt'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Augment @fastify/jwt so req.user is typed
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email: string; name: string | null; role: string; orgId: string | null }
    user:    { userId: string; email: string; name: string | null; role: string; orgId: string | null }
  }
}

// Augment FastifyInstance so app.authenticate is known
declare module 'fastify' {
  interface FastifyInstance {
    authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void>
  }
}