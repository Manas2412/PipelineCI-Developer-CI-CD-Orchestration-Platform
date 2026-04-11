import { redis, Keys } from 'redis'
import { prisma, RunStatus } from 'db'
import { parsePipelineYaml, buildDag, getReadySteps } from './dag'
import { enqueueJob } from './queue'
import type { DagGraph, JobMessage } from 'types'

const CONSUMER_GROUP = 'scheduler'
const CONSUMER_NAME = `scheduler-${process.pid}`
const BLOCK_MS = 5000 // block for 5s waiting for new messages


// ─────────────────────────────────────────────────────────────
// Start the scheduler loop — runs forever in the background
// ─────────────────────────────────────────────────────────────

export async function startScheduler(): Promise<void> {
    console.log('[Scheduler] Starting...')

    //Recover any pending (unacked) messages from previous crash
    await recoverPending()

    //Main loop 
    while(true) {
        try {
            await tick()
        }catch (err) {
            console.error('[Scheduler] tick error', err)
            await sleep(1000)
        }
    }
}



// ─────────────────────────────────────────────────────────────
// One tick: read new step-complete events and advance the DAG
// ─────────────────────────────────────────────────────────────

async function tick(): Promise<void> {
    const results = await redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', '10',
        'BLOCK', String(BLOCK_MS),
        'STREAMS', Keys.stepCompleteStream(), '>'
    ) as Array<[string, Array<[string, string[]]>]> | null

    if(!results || results.length === 0) 
        return

    const [ , messages] = results[0]!

    for(const [msgId, fields] of messages) {
        const data = fieldsToObject(fields)

        try {
            await handleStepComplete({
                runId: data.runId!,
                stepRunId: data.stepRunId!,
                stepName: data.stepName!,
                exitCode: Number(data.exitCode),
                status: data.status as 'SUCCESS' | 'FAILED' | 'CANCELLED'
            })

            //ACK only after successful processing
            await redis.xack(Keys.stepCompleteStream(), CONSUMER_GROUP, msgId)
        }catch (err) {
            console.error(`[Scheduler] Failed to handle step complete ${msgId}:`, err)
            //Don't ack - message will be redelivered
        }
    }
}



// ─────────────────────────────────────────────────────────────
// Handle a single step completing — update DB and enqueue next steps
// ─────────────────────────────────────────────────────────────

export async function handleStepComplete(msg: {
    runId: string,
    stepRunId: string,
    stepName: string,
    exitCode: number,
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
}): Promise<void> {
    const {runId, stepRunId, stepName, exitCode, status} = msg

    // 1. Update the StepRun in DB
    await prisma.stepRun.update({
        where: {id: stepRunId},
        data: {
            status: status === 'SUCCESS' ? RunStatus.SUCCESS : status === 'CANCELLED' ? RunStatus.CANCELLED : RunStatus.FAILED,
            exitCode: exitCode,
            finishedAt: new Date(),
        },
    })

    //2. Fetch the full run with all its steps
    const run = await prisma.run.findUniqueOrThrow({
        where: {id:runId},
        include: {
            pipeline: {select: {yamlConfig: true}},
            stepRuns: {select: {id:true, name:true, status: true}},
        },
    })

    //3. Check if this run was cancelled
    const cancelled = await redis.get(Keys.runCancel(runId))
    if(cancelled){
        await finaliseRun(runId, RunStatus.CANCELLED)
        return
    }

    //4. Rebuild the DAG from YAML
    const def = parsePipelineYaml(run.pipeline.yamlConfig)
    const graph: DagGraph = buildDag(def)

    const completeNames = new Set(
        run.stepRuns
        .filter(s => s.status === RunStatus.SUCCESS)
        .map(s => s.name)
    )

    const failedNames = new Set(
        run.stepRuns
        .filter((s) => s.status === RunStatus.FAILED)
        .map((s) => s.name)
    )

    const runningNames = new Set(
        run.stepRuns
        .filter((s) => s.status === RunStatus.RUNNING)
        .map((s) => s.name)
    )

    //5. If any step failed and no steps are still running -> run fails
    if(failedNames.size>0 && runningNames.size === 0){
        //Mark remaining PENDING steps as SKIPPED
        await prisma.stepRun.updateMany({
            where: {runId, status: RunStatus.PENDING},
            data: {status: RunStatus.SKIPPED}
        })
        await finaliseRun(runId, RunStatus.FAILED)
        return
    }

    //6. Find steps that are now unblocked
    const readyStepNames = getReadySteps(graph, completeNames, failedNames, runningNames)

    if(readyStepNames.length === 0 && runningNames.size === 0) {
        //Nothing left to run -> success
        if(failedNames.size === 0) {
            await finaliseRun(runId, RunStatus.SUCCESS)
        }
        return
    }

    //7. Enqueue each ready step
    for(const stepName of readyStepNames) {
        const stepDef = def.steps.find((s) => s.name === stepName)!
        const stepRun = run.stepRuns.find((s) => s.name === stepName)!

        //Mark as QUEUED in DB
        await prisma.stepRun.update({
            where: {id: stepRun.id},
            data: {status: RunStatus.QUEUED}
        })

        const job: JobMessage = {
            runId, 
            stepRunId: stepRun.id,
            stepName,
            image: stepDef.image,
            commands: stepDef.commands,
            env: {...(def.env ?? {}), ...(stepDef.env ?? {})},
            timeoutSeconds: stepDef.timeout ?? 600,
        }
        await enqueueJob(job)
    }
}



// ─────────────────────────────────────────────────────────────
// Kick off a brand new run — enqueue the root steps (depth = 0)
// ─────────────────────────────────────────────────────────────

export async function kickOffRun(runId: string): Promise<void> {
    const run = await prisma.run.findFirstOrThrow({
        where: {id: runId},
        include: {
            pipeline: {select: {yamlConfig: true}},
            stepRuns: {select : {id: true, name: true, status: true}},
        },
    })
    const def = parsePipelineYaml(run.pipeline.yamlConfig)
    const graph = buildDag(def)

    //Root steps = steps with no dependencies
    const rootStepNames = Object.values(graph)
    .filter((n) => n.dependsOn.length === 0)
    .map((n) => n.name)

    await prisma.run.update({
        where: {id: runId},
        data: {status: RunStatus.RUNNING, startedAt: new Date()},
    })

    for(const stepName of rootStepNames) {
        const stepDef = def.steps.find((s) => s.name === stepName)!
        const stepRun = run.stepRuns.find((s) => s.name === stepName)!

        await prisma.stepRun.update({
            where: {id: stepRun.id},
            data: {status: RunStatus.QUEUED},
        })

        const job: JobMessage = {
            runId,
            stepRunId: stepRun.id,
            stepName,
            image: stepDef.image,
            commands: stepDef.commands,
            env: {...(def.env ?? {}), ...(stepDef.env ?? {})},
            timeoutSeconds: stepDef.timeout ?? 600,
        }
        await enqueueJob(job)
    }
    console.log(`[Scheduler] Kicked off run ${runId} - ${rootStepNames.length} root step(s) queued`)
}



// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
async function finaliseRun(runId: string, finalStatus: RunStatus): Promise<void> {
    await prisma.run.update({
        where: {id: runId},
        data: {
            status: finalStatus,
            finishedAt: new Date(),
        },
    })
    //Notify SSE clients that the run has ended
    await redis.publish(Keys.runStatusChannel(runId), JSON.stringify({runId, status: finalStatus}))
    console.log(`[Scheduler] Finalised run ${runId} as ${finalStatus}`)
}

async function recoverPending(): Promise<void> {
    //Read messages that were delivered to us but not ACKed (e.g. after a crash)
    const pending = await redis.xreadgroup(
        'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
        'COUNT', '100',
        'STREAMS', Keys.stepCompleteStream(), '0'   // '0' = read pending for this consumer
    ) as Array<[string, Array<[string, string[]]>]> | null

    if(!pending || !pending[0] || pending[0][1].length === 0)
        return

    console.log(`[Scheduler] Recovering ${pending[0][1].length} pending message(s)...`)

    const [ , messages] = pending[0]
    for(const [msgId, fields] of messages) {
        const data = fieldsToObject(fields)
        try {
            await handleStepComplete({
                runId: data.runId!,
                stepRunId: data.stepRunId!,
                stepName: data.stepName!,
                exitCode: Number(data.exitCode),
                status: data.status as 'SUCCESS' | 'FAILED' | 'CANCELLED',
            })
            await redis.xack(Keys.stepCompleteStream(), CONSUMER_GROUP, msgId)
        } catch (error) {
            console.error(`[Scheduler] Failed to recover step ${data.stepRunId}:`, error)
        }
    } 
}

function fieldsToObject(fields: string[]): Record<string, string> {
    const obj: Record<string,string> = {}
    for(let i=0; i<fields.length; i += 2){
        obj[fields[i]!] = fields[i+1]!
    }
    return obj
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
