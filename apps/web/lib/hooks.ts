import { useEffect, useRef, useState, useCallback } from "react";
import {useQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {runsApi, pipelinesApi, projectApi, runnersApi, logsApi} from './api'   
import type { LogEvent } from "types";

// ─────────────────────────────────────────────────────────────
// SSE log streaming hook
// ─────────────────────────────────────────────────────────────

export function useLogStream(stepRunId: string | null) {
    const [lines, setLines] = useState<LogEvent[]>([])
    const [done, setDone] = useState(false)
    const esRef = useRef<EventSource | null>(null)

    useEffect(() => {
        if (!stepRunId) return

        setLines([])
        setDone(false)

        const token = localStorage.getItem('token') ?? ''
        const url = logsApi.streamUrl(stepRunId) + `?token=${token}`

        const es = new EventSource(url)
        esRef.current = es

        es.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data)
                if (data.type == 'DONE') {
                    setDone(true)
                    es.close()
                    return
                }
                setLines((prev) => [...prev, data as LogEvent])
            } catch { }
        }

        es.onerror = () => {
            setDone(true)
            es.close()
        }

        return () => {
            es.close()
        }
    }, [stepRunId])

    return { lines, done }
}


// ─────────────────────────────────────────────────────────────
// SSE run status stream — re-fetches run data when status changes
// ─────────────────────────────────────────────────────────────

export function useRunStatusStream(runId: string) {
    const qc = useQueryClient()

    useEffect(() => {
        if(!runId)
            return

        const token = localStorage.getItem('token') ?? ''
        const url = logsApi.runStatusStreamUrl(runId) + `?token=${token}`
        const es = new EventSource(url)

        es.onmessage = () => {
            // Any status event -> invalidate run query to re-fetch
            qc.invalidateQueries({queryKey: ['run', runId]})
            qc.invalidateQueries({queryKey: ['run-status', runId]})
        }

        return () => es.close()
    }, [runId, qc])
}



// ─────────────────────────────────────────────────────────────
// Data queries
// ─────────────────────────────────────────────────────────────

export function useRun(id: string) {
    return useQuery({
        queryKey: ['run', id],
        queryFn: () => runsApi.get(id),
        refetchInterval: (query) => {
            const status = query.state.data?.status
            return ['PENDING', 'QUEUED', 'RUNNING'].includes(status) ? 3000 : false
        }
    })
}

export function useRunStats(id: string) {
    return useQuery({
        queryKey: ['run-stats', id],
        queryFn: () => runsApi.stats(id),
        refetchInterval: (query) => {
            const status = query.state.data?.status
            return ['PENDING', 'QUEUED', 'RUNNING'].includes(status) ? 3000 : false
        }
    })
}

export function useRuns(params: { pipelineId?: string; projectId?: string; page?: number }) {
  return useQuery({
    queryKey: ['runs', params],
    queryFn:  () => runsApi.list({ ...params, pageSize: 20 }),
  })
}
 
export function usePipeline(id: string) {
  return useQuery({
    queryKey: ['pipeline', id],
    queryFn:  () => pipelinesApi.get(id),
    enabled:  !!id,
  })
}
 
export function usePipelines(projectId: string) {
  return useQuery({
    queryKey: ['pipelines', projectId],
    queryFn:  () => pipelinesApi.list(projectId),
    enabled:  !!projectId,
  })
}
 
export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn:  () => projectApi.get(id),
    enabled:  !!id,
  })
}
 
export function useRunners() {
  return useQuery({
    queryKey: ['runners'],
    queryFn:  () => runnersApi.list(),
    refetchInterval: 10_000,
  })
}
 
// ─────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────
 
export function useTriggerRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: runsApi.trigger,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['runs'] }),
  })
}
 
export function useCancelRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => runsApi.cancel(id),
    onSuccess:  (_d, id) => qc.invalidateQueries({ queryKey: ['run', id] }),
  })
}
 
export function useUpdatePipeline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      pipelinesApi.update(id, body),
    onSuccess: (_d, { id }) => qc.invalidateQueries({ queryKey: ['pipeline', id] }),
  })
}
 
export function useValidatePipeline() {
  return useMutation({
    mutationFn: ({ id, yamlConfig }: { id: string; yamlConfig: string }) =>
      pipelinesApi.validate(id, { yamlConfig }),
  })
}