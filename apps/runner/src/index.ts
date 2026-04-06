import Docker from 'dockerode'
import { redis, Keys } from 'redis'
import { prisma, RunStatus } from 'db'
import type { jobMessage as JobMessage } from "types"

const docker = new Docker();
const CONSUMER_GROUP = 'runners'
const CONSUMER_NAME = `runner-${process.pid}`
const BLOCK_MS = 5000
const HEARTBEAT_MS = 20_000

let runnerId: string | null = null

// ─────────────────────────────────────────────────────────────
// Runner startup — register with API and start loops
// ─────────────────────────────────────────────────────────────

async function main() {
    runnerId = await registerRunner()
    console.log(`[Runner] started as ${CONSUMER_NAME}, DB id: ${runnerId}`)

    //Heartbeat loop
    setInterval(() => sendHeartbeat(), HEARTBEAT_MS)

    //Recover pending jobs from previous crash
    await recoverPending()

    //main job consumption loop
    await consumeJobs()
}

async function registerRunner(): Promise<string> {
    const runner = await prisma.runner.create({
        data: {
            label: CONSUMER_NAME,
            status: 'ONLINE' as any,
            capacity: 4,
            hostname: process.env.HOSTNAME ?? 'localhost',
            version: '1.0.0',
            lastHeartbeat: new Date()
        },
    })

    await redis.set(Keys.runnerAlive(runner.id), '1', 'EX', 30)
    return runner.id
}

async function sendHeartbeat() {
    if (!runnerId)
        return
    await redis.set(Keys.runnerAlive(runnerId), '1', 'EX', 30)
    await prisma.runner.update({
        where: { id: runnerId },
        data: { lastHeartbeat: new Date() }
    })
}



// ─────────────────────────────────────────────────────────────
// Main consume loop
// ─────────────────────────────────────────────────────────────

async function consumeJobs() {
    while (true) {
        try {
            const results = await redis.xreadgroup(
                'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
                'COUNT', '1',
                'BLOCK', String(BLOCK_MS),
                'STREAMS', Keys.jobStream(), '>'
            ) as any

            if (!results || results.length === 0)
                continue

            const [, messages] = results[0]

            for (const [msgId, fields] of messages) {
                const job = parseJobMessage(fields)

                //Acquire distributed lock - prevents two runners racing the same step
                const locked = await redis.set(
                    Keys.stepLock(job.stepRunId),
                    CONSUMER_NAME,
                    'EX', 300,
                    'NX'
                )

                if (!locked) {
                    console.log(`[Runner] Step ${job.stepRunId} already locked, skipping`)
                    await redis.xack(Keys.jobStream(), CONSUMER_GROUP, msgId)
                    continue
                }

                try {
                    await executeStep(job)
                    await redis.xack(Keys.jobStream(), CONSUMER_GROUP, msgId)
                } catch (err) {
                    console.error(`[Runner] Step ${job.stepRunId} failed:`, err)
                    await failStep(job, String(err))
                    await redis.xack(Keys.jobStream(), CONSUMER_GROUP, msgId)
                } finally {
                    await redis.del(Keys.stepLock(job.stepRunId))
                }
            }
        } catch (err) {
            console.error(`[Runner] consume error:`, err)
            await sleep(1000)
        }
    }
}


// ─────────────────────────────────────────────────────────────
// Execute one step inside a Docker container
// ─────────────────────────────────────────────────────────────

async function executeStep(job: JobMessage) {
    console.log(`[Runner] Executing step "${job.stepName}" for job (${job.runId})`)

    //Mark as Running in DB
    await prisma.stepRun.update({
        where: { id: job.stepRunId },
        data: { status: RunStatus.RUNNING, startedAt: new Date() }
    })
    
    await pullImage(job.image)

    //Build the shell script commands array
    const script = job.commands.join('\n')

    //Create container
    const container = await docker.createContainer({
        Image: job.image,
        Cmd: ['sh', '-ec', script],
        Env: Object.entries(job.env).map(([k, v]) => `${k}=${v}`),
        HostConfig: {
            AutoRemove: false,
            Memory: 512 * 1024 * 1024,  // 512MB
            NanoCpus: 1_000_000_000,   // 1 CPU
        },
        Labels: {
            'pipelineci.runId': job.runId,
            'pipelineci.stepRunId': job.stepRunId
        }
    })

    // Attach to container stdout/stderr and stream logs to Redis
    const stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
    })

    await container.start()

    //Stream logs to Redis pub/sub + persist to DB
    let seq = 0
    const logBuffer: Array<{ seq: number; text: string; stream: 'STDOUT' | 'STDERR' }> = []

    const processLog = async (chunk: Buffer, type: 'STDOUT' | 'STDERR') => {
        const lines = chunk.toString('utf-8').split('\n').filter(Boolean)
        for (const line of lines) {
            seq++
            const entry = { seq, text: line, stream: type }
            logBuffer.push(entry)

            //Publish live line
            await redis.publish(
                Keys.logChannel(job.stepRunId),
                JSON.stringify({ ...entry, stepRunId: job.stepRunId })
            )
        }
    }

    await new Promise<void>((resolve, reject) => {
        docker.modem.demuxStream(
            stream,
            { write: (chunk: any) => { processLog(chunk, 'STDOUT'); return true; } } as any,
            { write: (chunk: any) => { processLog(chunk, 'STDERR'); return true; } } as any
        )

        stream.on('end', resolve)
        stream.on('error', reject)
    })

    //Wait for container to finish
    const waitResult = await container.wait()
    const exitCode = waitResult.StatusCode

    if (logBuffer.length > 0) {
        await prisma.logChunk.createMany({
            data: logBuffer.map((l) => ({
                stepRunId: job.stepRunId,
                seq: l.seq,
                text: l.text,
                stream: l.stream
            }))
        })
    }


    //Cleanup container
    await container.remove().catch(() => { })

    const status = exitCode === 0 ? RunStatus.SUCCESS : RunStatus.FAILED

    //Update StepRun
    await prisma.stepRun.update({
        where: { id: job.stepRunId },
        data: { status, exitCode, finishedAt: new Date() }
    })

    //Publish step-complete event back to scheduler
    await redis.xadd(
        Keys.stepCompleteStream(),
        '*',
        'runId', job.runId,
        'stepRunId', job.stepRunId,
        'exitCode', String(exitCode),
        'status', exitCode === 0 ? 'SUCCESS' : 'FAILED'
    )

    //Signal SSE clients that this step is done
    await redis.publish(
        Keys.logChannel(job.stepRunId),
        JSON.stringify({ type: 'DONE', stepRunId: job.stepRunId, exitCode, status })
    )

    console.log(`[Runner] Step ${job.stepRunId} completed with status ${status}`)
}


async function failStep(job: JobMessage, errorMessage: string) {
    await prisma.stepRun.update({
        where: { id: job.stepRunId },
        data: {
            status: RunStatus.FAILED,
            exitCode: 1,
            finishedAt: new Date(),
            errorMessage
        }
    })

    await redis.xadd(
        Keys.stepCompleteStream(),
        '*',
        'runId', job.runId,
        'stepRunId', job.stepRunId,
        'stepName', job.stepName,
        'exitCode', '1',
        'status', 'FAILED'
    )
}



// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function pullImage(image: string) {
    return new Promise<void>((resolve, reject) => {
        docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
            if (err) return reject(err)
            docker.modem.followProgress(stream, (err2: Error | null) => {
                if (err2) reject(err2)
                else resolve()
            })
        })
    })
}

async function recoverPending() {
    const pending = await redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', '10',
        'STREAMS', Keys.jobStream(), '0'
    ) as any

    if (!pending || pending[0][1].length === 0)
        return

    console.log(`[Runner] Recovered ${pending[0][1].length} pending jobs`)

    for (const [msgId, fields] of pending[0][1]) {
        const job = parseJobMessage(fields)

        try {
            await executeStep(job)
            await redis.xack(Keys.jobStream(), CONSUMER_GROUP, msgId)
        } catch (err) {
            await failStep(job, String(err))
            await redis.xack(Keys.jobStream(), CONSUMER_GROUP, msgId)
        }
    }
}

function parseJobMessage(fields: string[]): JobMessage {
    const obj: Record<string, string> = {}
    for (let i = 0; i < fields.length; i += 2) {
        if (fields[i] !== undefined) {
            obj[fields[i] as string] = fields[i + 1] as string
        }
    }

    return {
        runId: obj.runId || '',
        stepRunId: obj.stepRunId || '',
        stepName: obj.stepName || '',
        image: obj.image || '',
        commands: obj.commands ? JSON.parse(obj.commands) : [],
        env: obj.env ? JSON.parse(obj.env) : {},
        timeoutSeconds: obj.timeoutSeconds ? Number(obj.timeoutSeconds) : 0,
    }
}


function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
}

main().catch((err) => {
    console.error('[Runner] fatal:', err)
    process.exit(1)
})