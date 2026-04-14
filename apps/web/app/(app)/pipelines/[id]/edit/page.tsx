'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { toast } from 'sonner'
import { Save, Play, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { usePipeline, useUpdatePipeline, useValidatePipeline, useTriggerRun } from '../../../../../lib/hooks'
import { AppLayout } from '../../../../../components/layout'
import { Spinner, Button, Card } from '../../../../../components/ui'
import type { DagGraph } from 'types'

// Monaco must be loaded client-side only
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

// ─────────────────────────────────────────────────────────────
// DAG → React Flow nodes + edges
// ─────────────────────────────────────────────────────────────

function dagToFlow(graph: DagGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Group by depth for column layout
  const byDepth: Record<number, string[]> = {}
  for (const [name, node] of Object.entries(graph)) {
    if (!byDepth[node.depth]) byDepth[node.depth] = []
    byDepth[node.depth]!.push(name)
  }

  const COL_W = 220
  const ROW_H = 80

  for (const [depthStr, names] of Object.entries(byDepth)) {
    const depth = Number(depthStr)
    names.forEach((name, i) => {
      const node = graph[name]
      if (!node) return

      nodes.push({
        id:   name,
        type: 'default',
        data: { label: name },
        position: {
          x: depth * COL_W,
          y: i * ROW_H - ((names.length - 1) * ROW_H) / 2,
        },
        style: {
          background: '#18181b',
          border:     '1px solid #3f3f46',
          borderRadius: 8,
          color:      '#f4f4f5',
          fontSize:   12,
          padding:    '8px 14px',
          fontFamily: 'JetBrains Mono, monospace',
        },
      })

      for (const dep of node.dependsOn) {
        if (!graph[dep]) continue // skip missing deps
        edges.push({
          id:           `${dep}-${name}`,
          source:       dep,
          target:       name,
          animated:     false,
          style:        { stroke: '#52525b', strokeWidth: 1.5 },
          markerEnd:    { type: 'arrowclosed' as any, color: '#52525b' },
        })
      }
    })
  }

  return { nodes, edges }
}

// ─────────────────────────────────────────────────────────────
// Validation result banner
// ─────────────────────────────────────────────────────────────

function ValidationBanner({ result }: { result: any }) {
  if (!result) return null
  if (result.valid) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-950/40 border border-green-900 rounded-lg text-xs text-green-400">
        <CheckCircle2 size={13} />
        Valid — {result.stepCount} steps, {result.layers?.length} parallel layers
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900 rounded-lg text-xs text-red-400">
      <XCircle size={13} />
      {result.error}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main editor page
// ─────────────────────────────────────────────────────────────

export default function PipelineEditorPage(): React.ReactNode {
  const { id }                    = useParams<{ id: string }>()
  const router                    = useRouter()
  const { data: pipeline, isLoading } = usePipeline(id)
  const updatePipeline            = useUpdatePipeline()
  const validatePipeline          = useValidatePipeline()
  const triggerRun                = useTriggerRun()

  const [yaml,        setYaml]        = useState('')
  const [validation,  setValidation]  = useState<any>(null)
  const [dirty,       setDirty]       = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Seed editor when pipeline loads
  useEffect(() => {
    if (pipeline?.yamlConfig && !dirty) {
      setYaml(pipeline.yamlConfig)
    }
  }, [pipeline])

  // Auto-validate on YAML change (debounced)
  useEffect(() => {
    if (!yaml || !id) return
    const t = setTimeout(async () => {
      try {
        const result = await validatePipeline.mutateAsync({ id, yamlConfig: yaml })
        setValidation(result)
        if (result.valid && result.graph) {
          const { nodes: n, edges: e } = dagToFlow(result.graph)
          setNodes(n)
          setEdges(e)
        }
      } catch {}
    }, 700)
    return () => clearTimeout(t)
  }, [yaml, id])

  function handleEditorChange(value?: string) {
    setYaml(value ?? '')
    setDirty(true)
  }

  async function handleSave() {
    try {
      await updatePipeline.mutateAsync({ id, body: { yamlConfig: yaml } })
      toast.success('Pipeline saved')
      setDirty(false)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleTrigger() {
    try {
      if (dirty) await handleSave()
      const { runId } = await triggerRun.mutateAsync({ pipelineId: id })
      toast.success('Run started!')
      router.push(`/runs/${runId}`)
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

  if (!pipeline) {
    return (
      <AppLayout>
        <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
          <Link href="/projects" className="hover:text-zinc-200">Projects</Link>
          <span>/</span>
          <span className="text-zinc-200">Error</span>
        </div>
        <Card className="text-center py-12">
          <p className="text-sm text-zinc-400 mb-4">Pipeline not found or error loading data</p>
          <Link href="/projects">
            <Button variant="secondary" size="sm">Back to projects</Button>
          </Link>
        </Card>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <Link href="/projects" className="hover:text-zinc-200">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${pipeline.projectId}`} className="hover:text-zinc-200">
          {pipeline.projectId.slice(0, 8)}...
        </Link>
        <span>/</span>
        <span className="text-zinc-200">{pipeline.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold">{pipeline?.name}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Edit pipeline YAML — preview updates live</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <AlertCircle size={12} /> Unsaved changes
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={updatePipeline.isPending}
            onClick={handleSave}
            disabled={!dirty}
          >
            <Save size={13} /> Save
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={triggerRun.isPending}
            onClick={handleTrigger}
          >
            <Play size={13} /> Save & Run
          </Button>
        </div>
      </div>

      {/* Validation banner */}
      <div className="mb-4">
        <ValidationBanner result={validation} />
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-2 gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        {/* YAML editor */}
        <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
          <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-400">pipeline.yml</span>
            {validatePipeline.isPending && <Spinner size={11} />}
          </div>
          <MonacoEditor
            height="100%"
            defaultLanguage="yaml"
            theme="vs-dark"
            value={yaml}
            onChange={handleEditorChange}
            options={{
              fontSize:         13,
              fontFamily:       'JetBrains Mono, monospace',
              lineNumbers:      'on',
              minimap:          { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap:         'on',
              tabSize:          2,
              automaticLayout:  true,
            }}
          />
        </div>

        {/* DAG preview */}
        <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
          <div className="px-4 py-2 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400">DAG preview</span>
          </div>
          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-zinc-500">
              Valid YAML required to show DAG
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#27272a" gap={20} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor="#3f3f46"
                maskColor="rgba(0,0,0,0.6)"
                style={{ background: '#18181b' }}
              />
            </ReactFlow>
          )}
        </div>
      </div>
    </AppLayout>
  )
}