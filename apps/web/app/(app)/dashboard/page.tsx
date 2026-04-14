'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Plus, GitBranch, Play, Clock } from 'lucide-react'
import { projectApi, runsApi } from '@/lib/api'
import { DEFAULT_ORG_ID } from '@/lib/org'
import { AppLayout } from '@/components/layout'
import { StatusBadge, Card, Spinner, Empty, Button, durationMs, formatDuration } from '@/components/ui'

export default function DashboardPage() {
  // In a real app orgId comes from the auth context
  const ORG_ID = DEFAULT_ORG_ID

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', ORG_ID],
    queryFn:  () => projectApi.list(ORG_ID),
  })

  const { data: recentRuns } = useQuery({
    queryKey: ['runs', { pageSize: 10 }],
    queryFn:  () => runsApi.list({ pageSize: 10 }),
    refetchInterval: 10_000,
  })

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Overview of all projects and recent activity</p>
        </div>
        <Link href="/projects/new">
          <Button variant="primary" size="sm">
            <Plus size={14} /> New project
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total projects', value: projects?.length ?? '—' },
          {
            label: 'Runs today',
            value: recentRuns?.data?.filter((r: any) => {
              return new Date(r.createdAt) > new Date(Date.now() - 86400000)
            }).length ?? '—',
          },
          {
            label: 'Success rate',
            value: (() => {
              const runs = recentRuns?.data ?? []
              if (!runs.length) return '—'
              const ok = runs.filter((r: any) => r.status === 'SUCCESS').length
              return `${Math.round((ok / runs.length) * 100)}%`
            })(),
          },
        ].map((s) => (
          <Card key={s.label} className="bg-white dark:bg-zinc-900">
            <p className="text-xs text-zinc-400 mb-1">{s.label}</p>
            <p className="text-2xl font-semibold">{String(s.value)}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Projects */}
        <div className="col-span-3">
          <h2 className="text-sm font-medium text-zinc-500 mb-3">Projects</h2>

          {isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !projects?.length ? (
            <Empty
              title="No projects yet"
              description="Create your first project to start running pipelines"
              action={
                <Link href="/projects/new">
                  <Button variant="primary" size="sm">
                    <Plus size={13} /> Create project
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {projects.map((project: any) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                          <GitBranch size={14} className="text-brand-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{project.name}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {project._count?.pipelines ?? 0} pipelines · {project._count?.runs ?? 0} runs
                          </p>
                        </div>
                      </div>

                      {/* Latest run status */}
                      {project.pipelines?.[0]?.runs?.[0] && (
                        <StatusBadge status={project.pipelines[0].runs[0].status} />
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent runs */}
        <div className="col-span-2">
          <h2 className="text-sm font-medium text-zinc-500 mb-3">Recent runs</h2>
          <Card padding={false}>
            {!recentRuns?.data?.length ? (
              <div className="py-8 text-center text-sm text-zinc-400">No runs yet</div>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {recentRuns.data.slice(0, 8).map((run: any) => {
                  const dur = durationMs(run.startedAt, run.finishedAt)
                  return (
                    <li key={run.id}>
                      <Link
                        href={`/runs/${run.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <StatusBadge status={run.status} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{run.pipeline?.name}</p>
                          <p className="text-xs text-zinc-400">
                            {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {dur !== null && (
                          <span className="text-xs text-zinc-400 flex items-center gap-1">
                            <Clock size={10} />
                            {formatDuration(dur)}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}