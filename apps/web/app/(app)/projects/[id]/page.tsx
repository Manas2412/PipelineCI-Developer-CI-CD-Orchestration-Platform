'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Play, Plus, Settings, Clock, GitCommit } from 'lucide-react'
import { toast } from 'sonner'
import { useProject, useRuns, useTriggerRun } from '../../../../lib/hooks'
import { AppLayout } from '../../../../components/layout' 
import { StatusBadge, Card, Spinner, Button, Empty, formatDuration, durationMs } from '../../../../components/ui'

const STATUS_COLORS: Record<string, string> = {
  SUCCESS:   '#22c55e',
  FAILED:    '#ef4444',
  RUNNING:   '#f59e0b',
  CANCELLED: '#71717a',
  PENDING:   '#a1a1aa',
}

export default function ProjectPage(): React.ReactNode {
  const { id }              = useParams<{ id: string }>()
  const [selectedPipeline,  setSelectedPipeline]  = useState<string | null>(null)
  const [page, setPage]     = useState(1)

  const { data: project, isLoading } = useProject(id)
  const { data: runsData }           = useRuns({
    projectId:  id,
    pipelineId: selectedPipeline ?? undefined,
    page,
  })
  const trigger = useTriggerRun()

  async function handleTrigger(pipelineId: string) {
    try {
      const { runId } = await trigger.mutateAsync({ pipelineId })
      toast.success('Run triggered', { description: `Run ID: ${runId.slice(0, 8)}` })
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

  if (!project) return null

  // Build chart data from recent runs
  const chartData = (runsData?.data ?? []).slice(0, 20).reverse().map((r: any, i: number) => ({
    name:   `#${i + 1}`,
    dur:    durationMs(r.startedAt, r.finishedAt) ?? 0,
    status: r.status,
  }))

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
            <Link href="/projects" className="hover:text-zinc-200">Projects</Link>
            <span>/</span>
            <span className="text-zinc-200">{project.name}</span>
          </div>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-zinc-400 mt-1">{project.description}</p>
          )}
        </div>
        <Link href={`/projects/${id}/settings`}>
          <Button variant="ghost" size="sm"><Settings size={14} /></Button>
        </Link>
      </div>

      {/* Pipelines */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-500">Pipelines</h2>
          <Link href={`/projects/${id}/pipelines/new`}>
            <Button variant="secondary" size="sm"><Plus size={13} /> New pipeline</Button>
          </Link>
        </div>

        {!project.pipelines?.length ? (
          <Empty title="No pipelines" description="Add a pipeline to start running jobs" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {project.pipelines.map((pipeline: any) => {
              const lastRun = pipeline.runs?.[0]
              return (
                <Card key={pipeline.id} padding={false} className="overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{pipeline.name}</p>
                        <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                          {pipeline.trigger}
                        </span>
                      </div>
                      {lastRun ? (
                        <div className="flex items-center gap-2">
                          <StatusBadge status={lastRun.status} />
                          <span className="text-xs text-zinc-400">
                            {formatDistanceToNow(new Date(lastRun.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">No runs yet</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/pipelines/${pipeline.id}/edit`}>
                        <Button variant="ghost" size="sm"><Settings size={13} /></Button>
                      </Link>
                      <Button
                        variant="primary"
                        size="sm"
                        loading={trigger.isPending}
                        onClick={() => handleTrigger(pipeline.id)}
                      >
                        <Play size={12} /> Run
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Duration chart */}
      {chartData.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium mb-4">Run durations (last 20)</h2>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={14}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => formatDuration(v)}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                formatter={(v: number) => [formatDuration(v), 'Duration']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="dur" radius={[3, 3, 0, 0]}>
                {chartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#71717a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Run history table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-500">Run history</h2>
          {/* Pipeline filter */}
          <select
            className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5"
            value={selectedPipeline ?? ''}
            onChange={(e) => { setSelectedPipeline(e.target.value || null); setPage(1) }}
          >
            <option value="">All pipelines</option>
            {project.pipelines?.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <Card padding={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {['Status', 'Pipeline', 'Branch', 'Commit', 'Triggered', 'Duration', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {!runsData?.data?.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">
                    No runs yet
                  </td>
                </tr>
              ) : (
                runsData.data.map((run: any) => {
                  const dur = durationMs(run.startedAt, run.finishedAt)
                  return (
                    <tr key={run.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                      <td className="px-4 py-3 font-medium text-xs">{run.pipeline?.name}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{run.branch ?? '—'}</td>
                      <td className="px-4 py-3">
                        {run.commitSha ? (
                          <span className="font-mono text-xs text-zinc-400 flex items-center gap-1">
                            <GitCommit size={10} />
                            {run.commitSha.slice(0, 7)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {dur !== null ? (
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {formatDuration(dur)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/runs/${run.id}`}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {runsData && runsData.total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-xs text-zinc-400">
                {runsData.total} total runs
              </span>
              <div className="flex gap-2">
                <Button size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" disabled={!runsData.hasMore} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  )
}