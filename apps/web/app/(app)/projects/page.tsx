'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Plus, GitBranch, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { projectApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { AppLayout } from '@/components/layout'
import { Card, Spinner, Empty, Button, StatusBadge } from '@/components/ui'
import { useQueryClient, useMutation } from '@tanstack/react-query'

export default function ProjectsPage() {
  const user   = useAuthStore((s) => s.user)
  const ORG_ID = user?.orgId ?? ''
  const qc     = useQueryClient()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', ORG_ID],
    queryFn:  () => projectApi.list(ORG_ID),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', ORG_ID] })
      toast.success('Project deleted')
    },
    onError: (err: any) => toast.error(err.message),
  })

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return
    deleteMutation.mutate(id)
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-zinc-500 mt-0.5">All projects in your organisation</p>
        </div>
        <Link href="/projects/new">
          <Button variant="primary" size="sm">
            <Plus size={14} /> New project
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size={24} /></div>
      ) : !projects?.length ? (
        <Empty
          title="No projects yet"
          description="Create your first project to start running pipelines"
          action={
            <Link href="/projects/new">
              <Button variant="primary" size="sm"><Plus size={13} /> Create project</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {projects.map((project: any) => {
            const lastRun = project.pipelines?.[0]?.runs?.[0]
            return (
              <Card key={project.id} padding={false} className="hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                        <GitBranch size={16} className="text-brand-600" />
                      </div>
                      <div>
                        <Link href={`/projects/${project.id}`} className="font-semibold text-sm hover:text-brand-600 transition-colors">
                          {project.name}
                        </Link>
                        <p className="text-xs text-zinc-400 font-mono">{project.slug}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(project.id, project.name)}
                      className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {project.description && (
                    <p className="text-xs text-zinc-400 mb-3">{project.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 text-xs text-zinc-400">
                      <span>{project._count?.pipelines ?? 0} pipelines</span>
                      <span>·</span>
                      <span>{project._count?.runs ?? 0} runs</span>
                    </div>
                    {lastRun && <StatusBadge status={lastRun.status} />}
                  </div>

                  {project.repoUrl && (
                    <a
                      href={project.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors block truncate"
                    >
                      {project.repoUrl}
                    </a>
                  )}

                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-xs text-zinc-400">
                      Created {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                    </span>
                    <Link href={`/projects/${project.id}`}>
                      <Button variant="ghost" size="sm">Open →</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}