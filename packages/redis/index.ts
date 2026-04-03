import { Redis } from 'ioredis'

declare global {
    var __redis: Redis | undefined
    var __redisSub: Redis | undefined
}

function createRedisClient(name = 'default'): Redis {
    const client = new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD ?? undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: false,
        retryStrategy: (times) => Math.min(times*200,2000), 
    })

    client.on('connect', () => console.log(`[Redis: ${name}] connected`))
    client.on('error', (err) => console.log(`[Redis: ${name}] error`, err))

    return client
}

// Main client - used for commands (GET, SET, XADD, INCR ...)
export const redis:Redis = globalThis.__redis ?? createRedisClient('main')
if(process.env.NODE_ENV != 'production') globalThis.__redis = redis

// Subscriber client - dedicated connection for pub/sub (can't be reused for commands)
export const redisSub: Redis = globalThis.__redisSub ?? createRedisClient('sub')
if(process.env.NODE_ENV != 'production') globalThis.__redisSub = redisSub


// ─────────────────────────────────────────────────────────────
// Redis key helpers — centralized so nothing is misspelled
// ─────────────────────────────────────────────────────────────

export const Keys = {
    //Stream
    jobStream: () => 'pipeline:jobs',
    stepCompleteStream: () => 'pipeline:step-complete',

    //Pub-Sub channels
    logChannel: (stepRunId: string) => `log:${stepRunId}`,
    runStatusChannel: (runId: string) => `run:status:${runId}`,

    //Runner heartbeat (expires every 30s - runner must refresh)
    runnerAlive: (runnerId:string) => `runner:${runnerId}:alive`,

    //Distributed lock - prevents two runner picking the same step
    stepLock: (stepRunId: string) => `lock:step:${stepRunId}`,

    //Cancel flag - runner polls this; if set it kills the container
    runCancel: (runId: string) => `run:${runId}:cancel`,

    //Log sequence counter - INCR this before publishing each line
    logSeq: (stepRunId: string) => `log:seq:${stepRunId}`,

    //Artifact signed-URL cache
    artifactUrl: (artifactId: string) => `artifact:${artifactId}:url`,

    //Rate Limiting
    webhookRateLimit: (projectId: string) => `ratelimit:webhook:${projectId}`
} as const 

export default redis