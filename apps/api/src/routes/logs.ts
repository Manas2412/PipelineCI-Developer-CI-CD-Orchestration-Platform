import type {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify'
import {prisma} from "db"
import {redisSub, redis, Keys} from "redis"

export async function logsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', app.authenticate)

    //GET /api/logs:stepRunId/stream -- SSE live log stream
    app.get('/:stepRunId/streams', async(req: FastifyRequest, reply: FastifyReply) => {
        const {stepRunId} = req.params as {stepRunId: string}

        //verify the stepRun exists
        await prisma.stepRun.findUniqueOrThrow({
            where: {id: stepRunId}
        })

        //Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',  // disable nginx buffering
        })

        // -- 1. Reply historical logs first(so late joiners get full output) --
        const historical = await prisma.logChunk.findMany({
            where: {stepRunId},
            orderBy: {seq: 'asc'}
        })

        for(const chunk of historical){
            const payload = JSON.stringify({
                seq: chunk.seq,
                text: chunk.text,
                stream: chunk.stream,
                stepRunId: chunk.stepRunId
            })
            reply.raw.write(`data: ${payload}\n\n`)
        }

        // --2. Subscribe to live channel for new lines --
        const channel = Keys.logChannel(stepRunId)

        //Create a dedicated subscriber for this connection
        const sub = redisSub.duplicate()
        await sub.subscribe(channel)

        sub.on('message', (_chan: string, message: string) => {
            reply.raw.write(`data: ${message}\n\n`)
        })

        //Heartbeat to prevent proxy timeout
        const heartbeat = setInterval(() => {
            reply.raw.write(':heartbeat\n\n')
        }, 15_000)

        //Cleanup when clinet disconnects
        req.raw.on('close', async () => {
            clearInterval(heartbeat)
            await sub.unsubscribe(channel)
            await sub.disconnect()
        })
    })


    //GET /api/logs/:stepRunId. -- fetch persisted logs (paginated)
    app.get('/:stepRunId', async (req, reply) => {
        const {stepRunId} = req.params as {stepRunId: string}
        const {page = '1', pageSize = '500'} = req.query as Record<string,string>

        const skip = (Number(page) - 1) * Number(pageSize)

        const [chunk, total] = await Promise.all([
            prisma.logChunk.findMany({
                where: { stepRunId },
                orderBy: { seq: 'asc' },
                skip,
                take: Number(pageSize)
            }),
            prisma.logChunk.count({ where: { stepRunId } })
        ])

        return reply.send({
            success: true,
            data: {
                data: chunk,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                hasMore: skip + chunk.length < total
            }
        })
    })


    //GET /api/logs/run/:runId/stream -- SSE for run-level status events
    app.get('/run/:runId/status-stream', async (req: FastifyRequest, reply: FastifyReply) => {
        const {runId} = req.params as {runId: string}

        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',  // disable nginx buffering
        })

        const channel = Keys.runStatusChannel(runId)
        const sub = redisSub.duplicate()
        await sub.subscribe(channel)

        sub.on('message', (_chan: string, message: string) => {
            reply.raw.write(`data: ${message}\n\n`)
        })

        const heartbeat = setInterval(() => {
            reply.raw.write(':heartbeat\n\n')
        }, 15_000)

        req.raw.on('close', async () => {
            clearInterval(heartbeat)
            await sub.unsubscribe(channel)
            await sub.disconnect()
        })
    })
}