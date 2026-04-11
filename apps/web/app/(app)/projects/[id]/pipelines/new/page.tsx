'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { pipelinesApi } from '@/lib/api'
import { AppLayout } from '@/components/layout'
import { Card, Button } from '@/components/ui'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

const DEFAULT_YAML = `name: My Pipeline

steps:
  - name: install
    image: node:20-alpine
    commands:
      - npm ci

  - name: test
    image: node:20-alpine
    dependsOn: [install]
    commands:
      - npm test

  - name: build
    image: node:20-alpine
    dependsOn: [test]
    commands:
      - npm run build
`

const TRIGGER_OPTIONS = [
  { value: 'MANUAL',       label: 'Manual',        desc: 'Triggered only by hand or API' },
  { value: 'PUSH',         label: 'Push',          desc: 'Runs on every git push' },
  { value: 'PULL_REQUEST', label: 'Pull request',  desc: 'Runs when a PR is opened or updated' },
  { value: 'SCHEDULE',     label: 'Schedule',      desc: 'Runs on a cron schedule' },
]

export default function NewPipelinePage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router            = useRouter()
  const qc                = useQueryClient()

  const [name,       setName]       = useState('')
  const [description,setDescription]= useState('')
  const [trigger,    setTrigger]    = useState('MANUAL')
  const [branch,     setBranch]     = useState('main')
  const [cronExpr,   setCronExpr]   = useState('0 2 * * *')
  const [yamlConfig, setYamlConfig] = useState(DEFAULT_YAML)

  const createMutation = useMutation({
    mutationFn: () =>
      pipelinesApi.create({ name, description: description || undefined, yamlConfig, trigger, branch: branch || undefined, cronExpr: cronExpr || undefined, projectId }),
    onSuccess: (pipeline: any) => {
      qc.invalidateQueries({ queryKey: ['pipelines', projectId] })
      qc.invalidateQueries({ queryKey: ['project',   projectId] })
      toast.success('Pipeline created!')
      router.push(`/pipelines/${pipeline.id}/edit`)
    },
    onError: (err: any) => toast.error(err.message),
  })

  function handleSubmit(e: React.FormEvent) {
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
          <Link href={`/projects/${projectId}`} className="hover:text-zinc-600 dark:hover:text-zinc-200">Project</Link>
          <span>/</span>
          <span>New pipeline</span>
        </div>
        <h1 className="text-xl font-semibold">Create pipeline</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-5 gap-6">

          {/* Left: metadata */}
          <div className="col-span-2 space-y-4">
            <Card>
              <h2 className="text-sm font-medium mb-4">Pipeline details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className={inputCls}
                    placeholder="Build and deploy"
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
                  <label className="block text-xs font-medium text-zinc-500 mb-2">Trigger</label>
                  <div className="space-y-2">
                    {TRIGGER_OPTIONS.map((opt) => (
                      <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                        ${trigger === opt.value
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                        <input
                          type="radio"
                          name="trigger"
                          value={opt.value}
                          checked={trigger === opt.value}
                          onChange={() => setTrigger(opt.value)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-xs font-medium">{opt.label}</p>
                          <p className="text-xs text-zinc-400">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {(trigger === 'PUSH' || trigger === 'PULL_REQUEST') && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">Branch</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className={inputCls}
                      placeholder="main"
                    />
                  </div>
                )}

                {trigger === 'SCHEDULE' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1.5">Cron expression</label>
                    <input
                      type="text"
                      value={cronExpr}
                      onChange={(e) => setCronExpr(e.target.value)}
                      className={`${inputCls} font-mono`}
                      placeholder="0 2 * * *"
                    />
                    <p className="text-xs text-zinc-400 mt-1">e.g. <code className="font-mono">0 2 * * *</code> = every day at 2am</p>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex gap-3">
              <Button type="submit" variant="primary" loading={createMutation.isPending} disabled={!name}>
                Create pipeline
              </Button>
              <Link href={`/projects/${projectId}`}>
                <Button variant="ghost">Cancel</Button>
              </Link>
            </div>
          </div>

          {/* Right: YAML editor */}
          <div className="col-span-3">
            <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950" style={{ height: 520 }}>
              <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-400 font-mono">pipeline.yml</span>
                <span className="text-xs text-zinc-600 ml-auto">Edit before creating, or change later</span>
              </div>
              <MonacoEditor
                height="100%"
                defaultLanguage="yaml"
                theme="vs-dark"
                value={yamlConfig}
                onChange={(v) => setYamlConfig(v ?? '')}
                options={{
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  lineNumbers: 'on',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  automaticLayout: true,
                }}
              />
            </div>
          </div>

        </div>
      </form>
    </AppLayout>
  )
}