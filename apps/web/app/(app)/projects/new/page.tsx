'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { AppLayout } from '@/components/layout'
import { Card, Button } from '@/components/ui'

// Derive slug from name automatically
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function NewProjectPage() {
  const router = useRouter()
  const qc     = useQueryClient()

  const [name,        setName]        = useState('')
  const [slug,        setSlug]        = useState('')
  const [repoUrl,     setRepoUrl]     = useState('')
  const [description, setDescription] = useState('')
  const [slugEdited,  setSlugEdited]  = useState(false)

  const user = useAuthStore((s) => s.user)
  const orgId = user?.orgId ?? null

  const createMutation = useMutation({
    mutationFn: () => {
      if (!orgId) throw new Error('No organisation found. Please log out and log in again.')
      return projectApi.create({ name, slug, repoUrl: repoUrl || undefined, description: description || undefined, orgId })
    },
    onSuccess: (project: any) => {
      qc.invalidateQueries({ queryKey: ['projects', orgId] })
      toast.success('Project created!')
      router.push(`/projects/${project.id}`)
    },
    onError: (err: any) => toast.error(err.message),
  })

  function handleNameChange(val: string) {
    setName(val)
    if (!slugEdited) setSlug(toSlug(val))
  }

  function handleSlugChange(val: string) {
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    setSlugEdited(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate()
  }

  const inputCls = `w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200
    dark:border-zinc-700 text-sm focus:outline-none focus:border-brand-500 transition-colors`

  return (
    <AppLayout>
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
          <Link href="/projects" className="hover:text-zinc-600 dark:hover:text-zinc-200">Projects</Link>
          <span>/</span>
          <span>New project</span>
        </div>
        <h1 className="text-xl font-semibold">Create project</h1>
      </div>

      <div className="max-w-xl">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Project name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                autoFocus
                className={inputCls}
                placeholder="My awesome service"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                Slug *
                <span className="ml-1 text-zinc-400 font-normal">(used in URLs, lowercase alphanumeric + hyphens)</span>
              </label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-r-0 border-zinc-200 dark:border-zinc-700 rounded-l-lg text-sm text-zinc-400 select-none">
                  /projects/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  required
                  pattern="[a-z0-9-]+"
                  className={`${inputCls} rounded-l-none`}
                  placeholder="my-awesome-service"
                />
              </div>
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

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="What does this project do?"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                loading={createMutation.isPending}
                disabled={!name || !slug}
              >
                Create project
              </Button>
              <Link href="/projects">
                <Button variant="ghost">Cancel</Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </AppLayout>
  )
}