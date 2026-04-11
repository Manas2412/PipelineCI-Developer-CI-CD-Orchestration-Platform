'use client'
import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'
import { Server, Cpu, Activity } from 'lucide-react'
import { useRunners } from '../../../lib/hooks'
import { AppLayout } from '../../../components/layout'
import { Card, Spinner, Empty } from '../../../components/ui'

function RunnerStatusDot({ online }: { online: boolean }) {
  return (
    <span className={clsx(
      'inline-block w-2 h-2 rounded-full',
      online ? 'bg-green-500 animate-pulse-fast' : 'bg-zinc-500'
    )} />
  )
}

export default function RunnersPage(): React.ReactNode {
  const { data: runners, isLoading } = useRunners()

  const online  = runners?.filter((r: any) => r.online).length ?? 0
  const total   = runners?.length ?? 0
  const busyJobs = runners?.reduce((acc: number, r: any) => acc + (r.activeJobs ?? 0), 0) ?? 0

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-xl font-semibold">Runners</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Worker pool status — refreshes every 10s</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Online',     value: `${online} / ${total}`, icon: Activity },
          { label: 'Active jobs', value: busyJobs,              icon: Cpu      },
          { label: 'Total capacity', value: runners?.reduce((a: number, r: any) => a + r.capacity, 0) ?? 0, icon: Server },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400 mb-1">{label}</p>
                <p className="text-2xl font-semibold">{value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <Icon size={18} className="text-zinc-400" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Runner table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : !runners?.length ? (
          <Empty
            title="No runners registered"
            description="Start a runner process to begin executing pipeline jobs"
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {['Status', 'Label', 'Hostname', 'Jobs (active / cap)', 'Last heartbeat', 'Version'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {runners.map((runner: any) => (
                <tr key={runner.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <RunnerStatusDot online={runner.online} />
                      <span className="text-xs text-zinc-400">
                        {runner.online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">{runner.label}</td>
                  <td className="px-5 py-4 text-xs text-zinc-400">{runner.hostname ?? '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {runner.activeJobs} / {runner.capacity}
                      </span>
                      {/* Capacity bar */}
                      <div className="w-20 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all',
                            runner.activeJobs / runner.capacity > 0.8
                              ? 'bg-red-500'
                              : runner.activeJobs > 0
                              ? 'bg-amber-400'
                              : 'bg-zinc-400'
                          )}
                          style={{ width: `${(runner.activeJobs / runner.capacity) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-400">
                    {runner.lastHeartbeat
                      ? formatDistanceToNow(new Date(runner.lastHeartbeat), { addSuffix: true })
                      : '—'}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                    {runner.version ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppLayout>
  )
}