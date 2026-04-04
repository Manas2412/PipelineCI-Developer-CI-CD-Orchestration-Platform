import { redis, Keys } from "redis"
import type { jobMessage, StepCompleteMessage } from "types"

// ─────────────────────────────────────────────────────────────
// Enqueue a step for a runner to pick up
// ─────────────────────────────────────────────────────────────

export async function enqueueJob(msg: jobMessage): Promise<string> {
    const streamId = await redis.xadd(
        Keys.jobStream(),
        '*',  // Auto-generated stream ID
        'runId', msg.runId,
        'stepRunId', msg.stepRunId,
        'stepName', msg.stepName,
        'image', msg.image,
        'commands', JSON.stringify(msg.commands),
        'env', JSON.stringify(msg.env),
        'timeoutSeconds', String(msg.timeoutSeconds),
    )

    if(!streamId)
        throw new Error('Failed to enqueue job into Redis Stream')
    console.log(`[Queue] Enqueued step "${msg.stepName}" (${msg.stepRunId} -> ${streamId})`)
    return streamId;
}


// ─────────────────────────────────────────────────────────────
// Publish step completion back to the scheduler
// ─────────────────────────────────────────────────────────────

export async function publishStepComplete(msg: StepCompleteMessage): Promise<void> {
    await redis.xadd(
        Keys.stepCompleteStream(),
        "*", 
        'runId', msg.runId,
        'stepRunId', msg.stepRunId,
        'stepName', msg.stepName,
        'exitCode', String(msg.exitCode),
        'status', msg.status
    )
}
    

// ─────────────────────────────────────────────────────────────
// Consumer group bootstrap (call once at API startup)
// ──────────────────────────────────────────────────────────

export async function ensureConsumerGroup(): Promise<void> {
    const groups: Array<{stream:string; group:string}> = [
        {stream: Keys.jobStream(), group: 'runners'},
        {stream: Keys.stepCompleteStream(), group: 'scheduler'},
    ]

    for(const {stream, group} of groups) {
        try {
            //MKSTREAM creates the stream if it doesn't exist
            await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM')
            console.log(`[Queue] Consumer group "${group}" on "${stream}" ready`)
        }catch(err: unknown) {
            //BUSYGROUP means the group already exists, which is fine
            if(err instanceof Error && err.message.includes('BUSYGROUP')){
                // already exists, skip
            }else{
                throw err
            }
        }
    }
}


// ─────────────────────────────────────────────────────────────
// Publish a log line (used by the runner, exposed here for symmetry)
// ─────────────────────────────────────────────────────────────

export async function publishLogLine(
    stepRunId: string,
    text: string,
    stream: 'STDOUT' | 'STDERR' = 'STDOUT'
): Promise<number> {
    const seq = await redis.incr(Keys.logSeq(stepRunId))
    await redis.publish(
        Keys.logChannel(stepRunId),
        JSON.stringify({seq, text, stream, stepRunId})
    )
    return seq
}


// ─────────────────────────────────────────────────────────────
// Set / check the cancel flag for a run
// ─────────────────────────────────────────────────────────────

export async function setCancelFlag(runId: string): Promise<void> {
    await redis.set(Keys.runCancel(runId), '1', 'EX', 3600)
}

export async function isCancelled(runId: string): Promise<boolean> {
    const val = await redis.get(Keys.runCancel(runId))
    return val === '1'
}