import Docker from 'dockerode'
import { redis, Keys } from 'redis'
import { prisma, RunStatus, RunnerStatus } from 'db'
import type { JobMessage } from 'types'

const docker         = new Docker()
const CONSUMER_GROUP = 'runners'
const CONSUMER_NAME  = `runner-${process.pid}`
const BLOCK_MS       = 5000
const HEARTBEAT_MS   = 20_000

let runnerId: string | null = null

// ─────────────────────────────────────────────────────────────
// Runner startup — register with API and start loops
// ─────────────────────────────────────────────────────────────

async function main() {
  runnerId = await registerRunner()
  console.log(`[Runner] Started as ${CONSUMER_NAME}, DB id: ${runnerId}`)

  // Heartbeat loop
  setInterval(() => sendHeartbeat(), HEARTBEAT_MS)

  // Recover pending jobs from previous crash
  await recoverPending()

  // Main job consumption loop
  await consumeJobs()
}

async function registerRunner(): Promise<string> {
  const runner = await prisma.runner.create({
    data: {
      label:     CONSUMER_NAME,
      status:    RunnerStatus.ONLINE,
      capacity:  4,
      hostname:  process.env.HOSTNAME ?? 'localhost',
      version:   '1.0.0',
      lastHeartbeat: new Date(),
    },
  })

  await redis.set(Keys.runnerAlive(runner.id), '1', 'EX', 30)
  return runner.id
}

async function sendHeartbeat() {
  if (!runnerId) return
  await redis.set(Keys.runnerAlive(runnerId), '1', 'EX', 30)
  await prisma.runner.update({
    where: { id: runnerId },
    data:  { lastHeartbeat: new Date(), status: RunnerStatus.ONLINE },
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
      ) as Array<[string, Array<[string, string[]]>]> | null

      if (!results || results.length === 0) continue

      const first = results[0]
      if (!first) continue
      const [, messages] = first

      for (const [msgId, fields] of messages) {
        const job = parseJobMessage(fields)

        // Acquire distributed lock — prevents two runners racing the same step
        const locked = await redis.set(
          Keys.stepLock(job.stepRunId),
          CONSUMER_NAME,
          'EX', 300, 'NX'
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
      console.error('[Runner] consume error:', err)
      await sleep(1000)
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Execute one step inside a Docker container
// ─────────────────────────────────────────────────────────────

async function executeStep(job: JobMessage) {
  console.log(`[Runner] Executing step "${job.stepName}" (${job.stepRunId})`)

  // Mark as RUNNING in DB
  await prisma.stepRun.update({
    where: { id: job.stepRunId },
    data:  { status: RunStatus.RUNNING, startedAt: new Date(), runnerId: runnerId ?? undefined },
  })

  // Pull image if needed (no-op if already present)
  await pullImage(job.image)

  // 1. Create/Ensure a shared volume for this run's workspace
  // This allows files to persist between steps of the same run
  const volumeName = `pipelineci-run-${job.runId}`
  await docker.createVolume({ Name: volumeName }).catch(() => {})

  // 2. Clone the repo if repoUrl is provided (and it's the first step or folder is empty)
  // In a real system we'd check if it's already cloned, but for now we clone if repoUrl exists.
  if (job.repoUrl) {
    console.log(`[Runner] Cloning ${job.repoUrl} into volume ${volumeName}`)
    await pullImage('alpine/git')
    const gitContainer = await docker.createContainer({
      Image: 'alpine/git',
      Cmd: ['clone', '--depth', '1', '--branch', job.branch || 'main', job.repoUrl, '.'],
      WorkingDir: '/workspace',
      HostConfig: {
        Binds: [`${volumeName}:/workspace`],
      },
    })
    await gitContainer.start()
    const { StatusCode } = await gitContainer.wait()
    await gitContainer.remove()
    
    if (StatusCode !== 0 && StatusCode !== 128) { // 128 often means already exists
       console.warn(`[Runner] Git clone exited with ${StatusCode}`)
    }
  }

  // Build the shell script from commands array
  const script = job.commands.join('\n')

  // Create container
  const container = await docker.createContainer({
    Image: job.image,
    Cmd:   ['sh', '-ec', script],
    WorkingDir: '/workspace',
    Env:   Object.entries(job.env).map(([k, v]) => `${k}=${v}`),
    HostConfig: {
      AutoRemove: false,
      Memory:     1024 * 1024 * 1024,   // 1GB limit
      NanoCpus:   1_000_000_000,        // 1 CPU
      Binds:      [`${volumeName}:/workspace`],
    },
    Labels: {
      'pipelineci.runId':     job.runId,
      'pipelineci.stepRunId': job.stepRunId,
    },
  })

  // Store container ID so we can kill it on cancellation
  const containerId = container.id

  // Attach to container stdout/stderr before starting
  const stream = await container.attach({
    stream: true,
    stdout: true,
    stderr: true,
  })

  await container.start()

  // Stream logs to Redis pub/sub + persist to DB
  let seq = 0
  const logBuffer: Array<{ seq: number; text: string; stream: 'STDOUT' | 'STDERR' }> = []

  await new Promise<void>((resolve, reject) => {
    container.modem.demuxStream(
      stream,
      // stdout handler
      {
        write: async (chunk: Buffer) => {
          const lines = chunk.toString('utf8').split('\n').filter(Boolean)
          for (const line of lines) {
            seq++
            const entry = { seq, text: line, stream: 'STDOUT' as const }
            logBuffer.push(entry)

            // Publish live line
            await redis.publish(
              Keys.logChannel(job.stepRunId),
              JSON.stringify({ ...entry, stepRunId: job.stepRunId })
            )

            // Check cancel flag on every line
            const cancelled = await redis.get(Keys.runCancel(job.runId))
            if (cancelled) {
              await container.kill().catch(() => {})
            }
          }
        },
      },
      // stderr handler
      {
        write: async (chunk: Buffer) => {
          const lines = chunk.toString('utf8').split('\n').filter(Boolean)
          for (const line of lines) {
            seq++
            const entry = { seq, text: line, stream: 'STDERR' as const }
            logBuffer.push(entry)

            await redis.publish(
              Keys.logChannel(job.stepRunId),
              JSON.stringify({ ...entry, stepRunId: job.stepRunId })
            )
          }
        },
      }
    )

    stream.on('end',   resolve)
    stream.on('error', reject)
  })

  // Wait for container to finish
  const { StatusCode: exitCode } = await container.wait()

  // Persist all log chunks in one batch insert
  if (logBuffer.length > 0) {
    await prisma.logChunk.createMany({
      data: logBuffer.map((l) => ({
        stepRunId: job.stepRunId,
        seq:       l.seq,
        text:      l.text,
        stream:    l.stream,
      })),
    })
  }

  // Cleanup container
  await container.remove().catch(() => {})

  const status = exitCode === 0 ? RunStatus.SUCCESS : RunStatus.FAILED

  // Update StepRun
  await prisma.stepRun.update({
    where: { id: job.stepRunId },
    data:  { status, exitCode, finishedAt: new Date() },
  })

  // Publish step-complete event back to the scheduler
  await redis.xadd(
    Keys.stepCompleteStream(),
    '*',
    'runId',      job.runId,
    'stepRunId',  job.stepRunId,
    'stepName',   job.stepName,
    'exitCode',   String(exitCode),
    'status',     exitCode === 0 ? 'SUCCESS' : 'FAILED'
  )

  // Signal SSE clients that this step is done
  await redis.publish(
    Keys.logChannel(job.stepRunId),
    JSON.stringify({ type: 'DONE', stepRunId: job.stepRunId, exitCode, status })
  )

  console.log(`[Runner] Step "${job.stepName}" exited ${exitCode} (${status})`)
}

async function failStep(job: JobMessage, errorMessage: string) {
  await prisma.stepRun.update({
    where: { id: job.stepRunId },
    data:  { status: RunStatus.FAILED, exitCode: 1, finishedAt: new Date(), errorMessage },
  })

  await redis.xadd(
    Keys.stepCompleteStream(),
    '*',
    'runId',      job.runId,
    'stepRunId',  job.stepRunId,
    'stepName',   job.stepName,
    'exitCode',   '1',
    'status',     'FAILED'
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
  ) as Array<[string, Array<[string, string[]]>]> | null

  const pendingFirst = pending?.[0]
  if (!pendingFirst || pendingFirst[1].length === 0) return

  console.log(`[Runner] Recovering ${pendingFirst[1].length} pending job(s)`)

  for (const [msgId, fields] of pendingFirst[1]) {
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
  for (let i = 0; i < fields.length - 1; i += 2) {
    const key = fields[i]
    const val = fields[i + 1]
    if (key !== undefined && val !== undefined) obj[key] = val
  }

  return {
    runId:          obj['runId']          ?? '',
    stepRunId:      obj['stepRunId']      ?? '',
    stepName:       obj['stepName']       ?? '',
    image:          obj['image']          ?? '',
    commands:       JSON.parse(obj['commands'] ?? '[]'),
    env:            JSON.parse(obj['env']      ?? '{}'),
    timeoutSeconds: Number(obj['timeoutSeconds'] ?? 0),
    repoUrl:        obj['repoUrl'],
    branch:         obj['branch'],
    commitSha:      obj['commitSha'],
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch((err) => {
  console.error('[Runner] Fatal:', err)
  process.exit(1)
})