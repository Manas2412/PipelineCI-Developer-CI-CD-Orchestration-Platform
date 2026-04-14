import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { prisma, UserRole } from 'db'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4).max(20)
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4).max(20),
  name: z.string().min(2).max(20)
})

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/register', async (req, reply) => {
    const body = registerSchema.parse(req.body)

    const exists = await prisma.user.findFirst({ where: { email: body.email } })
    if (exists) {
      return reply.status(409).send({
        success: false,
        error: 'Email already registered'
      })
    }

    const passwordHash = await bcrypt.hash(body.password, 10)

    // Create user + personal org + membership atomically
    const { user, org } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: body.email,
          password: passwordHash,
          name: body.name,
          role: UserRole.MEMBER,
        },
      })

      const orgSlug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, '') || 'personal'
      const newOrg = await tx.organization.create({
        data: { name: `${body.name}'s Org`, slug: orgSlug },
      })

      await tx.orgMember.create({
        data: { userId: newUser.id, orgId: newOrg.id, role: 'OWNER' },
      })

      return { user: newUser, org: newOrg }
    })

    const token = app.jwt.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: org.id,
    })

    return reply.status(201).send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgId: org.id,
        },
      },
    })
  })

  // POST /api/auth/login
  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body)

    const user = await prisma.user.findFirst({
      where: { email: body.email },
      include: { memberships: { take: 1, orderBy: { joinedAt: 'asc' } } },
    })

    if (!user) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(body.password, user.password)
    if (!valid) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' })
    }

    const orgId = user.memberships[0]?.orgId ?? null

    const token = app.jwt.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId,
    }, { expiresIn: '7d' })

    return reply.send({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl,
          orgId,
        },
      },
    })
  })

  // GET /api/auth/me (protected)
  app.get('/me', async (req, reply) => {
    const payload = req.user as { userId: string } | undefined
    if (!payload?.userId) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: payload.userId },
      include: { memberships: { take: 1, orderBy: { joinedAt: 'asc' } } },
    })

    const orgId = user.memberships[0]?.orgId ?? null

    return reply.send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        orgId,
      },
    })
  })
}