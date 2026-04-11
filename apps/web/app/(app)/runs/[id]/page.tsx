import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'
import { XCircle, Clock, Terminal, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useRun, useRunStats, useRunStatusStream, useLogStream, useCancelRun } from '../../../../lib/hooks'
import { AppLayout } from '../../../../components/layout' 
import { StatusBadge, Card, Spinner, Button, formatDuration, durationMs } from '../../../../components/ui'

// ─────────────────────────────────────────────────────────────
// Gantt chart
// ─────────────────────────────────────────────────────────────

function GanttChart({ steps }: { steps: any[] }) {
        if (!steps.length) return null

        const maxOffset = Math.max(
            ...steps
                .filter((s) => s.offsetMs !== null && s.durationMs !== null)
                .map((s) => (s.offsetMs ?? 0) + (s.durationMs ?? 0)),
            1
        )

        const STATUS_COLOR: Record<string, string> = {
            SUCCESS: 'bg-green-500',
            FAILED: 'bg-red-500',
            RUNNING: 'bg-amber-400 animate-pulse',
            QUEUED: 'bg-blue-400',
            CANCELLED: 'bg-zinc-500',
            PENDING: 'bg-zinc-700',
            SKIPPED: 'bg-zinc-700 opacity-40',
        }

        return (
            <div className="space-y-2">
                {steps.map((step) => {
                    const left = ((step.offsetMs ?? 0) / maxOffset) * 100
                    const width = Math.max(((step.durationMs ?? 0) / maxOffset) * 100, 0.5)

                    return (
                        <div key={step.id} className="flex items-center gap-3">
                            {/* Step name */}
                            <div className="w-36 shrink-0">
                                <p className="text-xs font-mono text-zinc-300 truncate">{step.name}</p>
                            </div>

                            {/* Bar track */}
                            <div className="flex-1 h-6 bg-zinc-800 rounded relative overflow-hidden">
                                {step.offsetMs !== null && (
                                    <div
                                        className={clsx(
                                            'absolute top-0 h-full rounded transition-all',
                                            STATUS_COLOR[step.status] ?? 'bg-zinc-600'
                                        )}
                                        style={{ left: `${left}%`, width: `${width}%`, minWidth: 4 }}
                                    />
                                )}
                            </div>

                            {/* Duration */}
                            <div className="w-16 text-right">
                                <span className="text-xs text-zinc-400 font-mono">
                                    {step.durationMs !== null
                                        ? formatDuration(step.durationMs)
                                        : step.status === 'RUNNING'
                                            ? '...'
                                            : '—'}
                                </span>
                            </div>

                            <div className="w-20">
                                <StatusBadge status={step.status} />
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

// ─────────────────────────────────────────────────────────────
// ANSI → plain text (simplified)
// ─────────────────────────────────────────────────────────────

function stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1B\[[0-9;]*[mGKHF]/g, '')
}

// ─────────────────────────────────────────────────────────────
// Log viewer
// ─────────────────────────────────────────────────────────────

function LogViewer({ stepRunId, stepName }: { stepRunId: string; stepName: string }) {
    const { lines, done } = useLogStream(stepRunId)
    const bottomRef = useRef<HTMLDivElement>(null)
    const [autoScroll, setAutoScroll] = useState(true)

    useEffect(() => {
        if (autoScroll) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [lines, autoScroll])

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 shrink-0">
                <Terminal size={13} className="text-zinc-400" />
                <span className="text-xs font-medium text-zinc-300 font-mono">{stepName}</span>
                {!done && <Spinner size={12} />}
                {done && <span className="text-xs text-zinc-500">— done</span>}
                <div className="ml-auto">
                    <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="w-3 h-3"
                        />
                        Auto-scroll
                    </label>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-zinc-950">
                {lines.length === 0 && !done && (
                    <p className="text-xs text-zinc-500 font-mono">Waiting for output…</p>
                )}
                {lines.map((line, i) => (
                    <div
                        key={i}
                        className={clsx(
                            'log-line',
                            line.stream === 'STDERR' ? 'log-stderr' : 'log-stdout'
                        )}
                    >
                        <span className="select-none text-zinc-600 mr-3 text-xs">{String(i + 1).padStart(4)}</span>
                        {stripAnsi(line.text)}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
// Run detail page
// ─────────────────────────────────────────────────────────────

export default function RunDetailPage(): React.ReactNode {
    const { id } = useParams<{ id: string }>()
    const { data: run, isLoading } = useRun(id)
    const { data: statsData } = useRunStats(id)
    const cancelRun = useCancelRun()
    const [selectedStep, setSelectedStep] = useState<{ id: string; name: string } | null>(null)

    // Subscribe to SSE run status events → invalidates queries automatically
    useRunStatusStream(id)

    // Auto-select first running/failed step
    useEffect(() => {
        if (!run?.stepRuns || selectedStep) return
        const active = run.stepRuns.find(
            (s: any) => s.status === 'RUNNING' || s.status === 'FAILED'
        )
        if (active) setSelectedStep({ id: active.id, name: active.name })
    }, [run])

    async function handleCancel() {
        try {
            await cancelRun.mutateAsync(id)
            toast.success('Cancellation requested')
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex justify-center py-20"><Spinner size={24} /></div>
            </AppLayout>
        )
    }
    if (!run) return null

    const totalDur = durationMs(run.startedAt, run.finishedAt)
    const isActive = ['PENDING', 'QUEUED', 'RUNNING'].includes(run.status)

    return (
        <AppLayout>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
                        <span>{run.pipeline?.name}</span>
                        <ChevronRight size={13} />
                        <span className="font-mono text-zinc-300">{id.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <StatusBadge status={run.status} />
                        {totalDur !== null && (
                            <span className="text-sm text-zinc-400 flex items-center gap-1">
                                <Clock size={13} /> {formatDuration(totalDur)}
                            </span>
                        )}
                        <span className="text-sm text-zinc-400">
                            {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                        </span>
                    </div>
                </div>

                {isActive && (
                    <Button
                        variant="danger"
                        size="sm"
                        loading={cancelRun.isPending}
                        onClick={handleCancel}
                    >
                        <XCircle size={13} /> Cancel run
                    </Button>
                )}
            </div>

            {/* Run meta */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Trigger', value: run.triggerType },
                    { label: 'Branch', value: run.branch ?? '—' },
                    { label: 'Commit', value: run.commitSha ? run.commitSha.slice(0, 7) : '—' },
                    { label: 'Triggered', value: run.triggeredBy ?? 'system' },
                ].map((m) => (
                    <div key={m.label} className="bg-zinc-100 dark:bg-zinc-900 rounded-lg px-3 py-2.5">
                        <p className="text-xs text-zinc-400 mb-1">{m.label}</p>
                        <p className="text-sm font-mono font-medium truncate">{m.value}</p>
                    </div>
                ))}
            </div>

            {/* Gantt + steps sidebar */}
            <Card className="mb-5" padding={false}>
                <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-sm font-medium">Step timeline</h2>
                </div>
                <div className="px-5 py-4">
                    <GanttChart steps={statsData?.steps ?? []} />
                </div>
            </Card>

            {/* Step list + log viewer */}
            <div className="grid grid-cols-3 gap-4" style={{ height: 480 }}>
                {/* Step list */}
                <div className="col-span-1 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-y-auto">
                    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                        <p className="text-xs font-medium text-zinc-500">Steps</p>
                    </div>
                    <ul className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {run.stepRuns?.map((step: any) => (
                            <li key={step.id}>
                                <button
                                    className={clsx(
                                        'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                                        selectedStep?.id === step.id
                                            ? 'bg-brand-50 dark:bg-brand-900/20'
                                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                                    )}
                                    onClick={() => setSelectedStep({ id: step.id, name: step.name })}
                                >
                                    <StatusBadge status={step.status} />
                                    <span className="text-xs font-mono flex-1 truncate">{step.name}</span>
                                    {step.exitCode !== null && (
                                        <span className={clsx('text-xs font-mono', step.exitCode === 0 ? 'text-green-400' : 'text-red-400')}>
                                            {step.exitCode}
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Log viewer */}
                <div className="col-span-2 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
                    {selectedStep ? (
                        <LogViewer stepRunId={selectedStep.id} stepName={selectedStep.name} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-sm text-zinc-500">
                            Select a step to view logs
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    )
}