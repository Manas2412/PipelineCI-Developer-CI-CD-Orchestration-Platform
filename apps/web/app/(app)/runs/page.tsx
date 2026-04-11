'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Clock, GitCommit, RefreshCw } from 'lucide-react'
import { runsApi } from '@/lib/api'
import { AppLayout } from '@/components/layout'
import { Card, Spinner, Empty, StatusBadge, formatDuration, durationMs } from '@/components/ui'

const STATUS_FILTERS = ['ALL', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED', 'PENDING']

export default function RunsPage() {
  const [page,          setPage]          = useState(1)
  const [statusFilter,  setStatusFilter]  = useState('ALL')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['runs-all', page, statusFilter],
    queryFn:  () => runsApi.list({ page, pageSize: 25 }),
    refetchInterval: 15_000,
  })

  const runs = (data?.data ?? []).filter((r: any) =>
    statusFilter === 'ALL' || r.status === statusFilter
  )

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">Runs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">All pipeline executions across every project</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg w-fit">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size={24} /></div>
      ) : !runs.length ? (
        <Empty title="No runs found" description="Runs will appear here once pipelines are triggered" />
      ) : (
        <Card padding={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {['Status', 'Pipeline', 'Project', 'Branch', 'Commit', 'Duration', 'Started', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {runs.map((run: any) => {
                const dur = durationMs(run.startedAt, run.finishedAt)
                return (
                  <tr key={run.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium">{run.pipeline?.name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {run.projectId ? (
                        <Link
                          href={`/projects/${run.projectId}`}
                          className="text-xs text-zinc-400 hover:text-brand-600 transition-colors"
                        >
                          {run.project?.name ?? run.projectId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {run.branch ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {run.commitSha ? (
                        <span className="font-mono text-xs text-zinc-400 flex items-center gap-1">
                          <GitCommit size={10} />
                          {run.commitSha.slice(0, 7)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {dur !== null ? (
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {formatDuration(dur)}
                        </span>
                      ) : run.status === 'RUNNING' ? (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Clock size={10} /> Running…
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
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
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {data && data.total > 25 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-xs text-zinc-400">{data.total} total runs</span>
              <div className="flex items-center gap-3">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <span className="text-xs text-zinc-500">Page {page}</span>
                <button
                  disabled={!data.hasMore}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </AppLayout>
  )
}