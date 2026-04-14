'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Copy, Eye, EyeOff } from 'lucide-react'
import { useProject } from '@/lib/hooks'
import { projectApi } from '@/lib/api'
import { AppLayout } from '@/components/layout'
import { Card, Spinner, Button } from '@/components/ui'

export default function ProjectSettingsPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const qc        = useQueryClient()

  const { data: project, isLoading } = useProject(id)

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [repoUrl,     setRepoUrl]     = useState('')
  const [showSecret,  setShowSecret]  = useState(false)
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (project) {
      setName(project.name ?? '')
      setDescription(project.description ?? '')
      setRepoUrl(project.repoUrl ?? '')
    }
  }, [project])

  const deleteMutation = useMutation({
    mutationFn: () => projectApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
      router.push('/projects')
    },
    onError: (err: any) => toast.error(err.message),
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      // Project update endpoint — PATCH /api/projects/:id
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/projects/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ name, description, repoUrl }),
      }).then((r) => r.json())

      qc.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Settings saved')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function copySecret() {
    if (project?.webhookSecret) {
      navigator.clipboard.writeText(project.webhookSecret)
      toast.success('Webhook secret copied')
    }
  }

  function handleDelete() {
    if (!confirm(`Permanently delete "${project?.name}" and all its pipelines and runs?`)) return
    deleteMutation.mutate()
  }

  const inputCls = `w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200
    dark:border-zinc-700 text-sm focus:outline-none focus:border-brand-500 transition-colors`

  if (isLoading) {
    return <AppLayout><div className="flex justify-center py-20"><Spinner size={24} /></div></AppLayout>
  }

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <Link href="/projects" className="hover:text-zinc-200">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-zinc-200">{project?.name}</Link>
        <span>/</span>
        <span className="text-zinc-200">Settings</span>
      </div>

      <h1 className="text-xl font-semibold mb-8">Project settings</h1>

      <div className="max-w-xl space-y-6">

        {/* General */}
        <Card>
          <h2 className="text-sm font-semibold mb-4">General</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Project name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className={`${inputCls} resize-none`}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Repository URL</label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className={inputCls}
                placeholder="https://github.com/org/repo"
              />
            </div>
            <Button type="submit" variant="primary" loading={saving}>
              Save changes
            </Button>
          </form>
        </Card>

        {/* Webhook */}
        <Card>
          <h2 className="text-sm font-semibold mb-1">Webhook</h2>
          <p className="text-xs text-zinc-400 mb-4">
            Send push events to this URL to trigger pipelines automatically.
            The secret is used to verify the <code className="font-mono">X-Hub-Signature-256</code> header.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Webhook URL</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/projects/${id}/webhook`}
                  className={`${inputCls} font-mono text-xs bg-zinc-100 dark:bg-zinc-800/60`}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/projects/${id}/webhook`)
                    toast.success('URL copied')
                  }}
                  className="px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Webhook secret</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  type={showSecret ? 'text' : 'password'}
                  value={project?.webhookSecret ?? ''}
                  className={`${inputCls} font-mono text-xs bg-zinc-100 dark:bg-zinc-800/60`}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  type="button"
                  onClick={copySecret}
                  className="px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <Copy size={13} />
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">
                Add this as <code className="font-mono">WEBHOOK_SECRET</code> in your GitHub repository settings.
              </p>
            </div>
          </div>
        </Card>

        {/* Danger zone */}
        <Card className="border-red-200 dark:border-red-900/50">
          <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Danger zone</h2>
          <p className="text-xs text-zinc-400 mb-4">
            Deleting this project is permanent and cannot be undone. All pipelines, runs, and logs will be removed.
          </p>
          <Button
            variant="danger"
            size="sm"
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            <Trash2 size={13} /> Delete project
          </Button>
        </Card>

      </div>
    </AppLayout>
  )
}