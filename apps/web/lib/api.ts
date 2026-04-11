import { create } from "domain"
import type {
    ApiResponse,
    PaginatedResponse,
    LoginRequest,
    LoginResponse,
    CreateProjectRequest,
    CreatePipelineRequest,
    UpdatePipelineRequest,
    TriggerRunRequest,
    RunWithSteps,
    SafeUser
} from "types"

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ─────────────────────────────────────────────────────────────
// Core fetch helper
// ─────────────────────────────────────────────────────────────

async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const token = typeof window! == 'undefined' ? localStorage.getItem('token') : null

    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        }
    })

    const json = (await res.json()) as ApiResponse<T>
    if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Request failed: ${res.status}`)
    }

    return json.data as T
}


// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export const authApi = {
    login: (body: LoginRequest) => apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
    }),

    register: (body: LoginRequest & { name: string }) => apiFetch<LoginResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body)
    }),

    me: () => apiFetch<SafeUser>('/api/auth/me')
}


// ─────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────

export const projectApi = {
    list: (orgId: string) => apiFetch<any[]>(`/api/projects?orgId=${orgId}`),

    get: (id: string) => apiFetch<any>(`/api/projects/${id}`),

    create: (body: CreateProjectRequest) => apiFetch<any>(`/api/projects`, {
        method: 'POST',
        body: JSON.stringify(body),
    }),

    delete: (id: string) => apiFetch<void>(`/api/projects/${id}`, {
        method: 'DELETE',
    })
}


// ─────────────────────────────────────────────────────────────
// Pipelines
// ─────────────────────────────────────────────────────────────

export const pipelinesApi = {
    list: (projectId: string) => apiFetch<any[]>(`/api/pipelines?projectId=${projectId}`),

    get: (id: string) => apiFetch<any>(`/api/pipelines/${id}`),

    create: (body: CreatePipelineRequest) => apiFetch<any>(`/api/pipelines`, {
        method: 'POST',
        body: JSON.stringify(body),
    }),

    update: (id: string, body: UpdatePipelineRequest) => apiFetch<any>(`/api/pipelines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    }),

    delete: (id: string) => apiFetch<void>(`/api/pipelines/${id}`, {
        method: 'DELETE',
    }),

    validate: (id: string, body: UpdatePipelineRequest) => apiFetch<any>(`/api/pipelines/${id}/validate`, {
        method: 'POST',
        body: JSON.stringify(body),
    }),
}


// ─────────────────────────────────────────────────────────────
// Runs
// ─────────────────────────────────────────────────────────────

export const runsApi = {
    list: (params: {
        pipelineId?: string,
        projectId?: string,
        page?: number,
        pageSize?: number
    }) => {
        const qs = new URLSearchParams()
        if(params.pipelineId) qs.set('pipelineId', params.pipelineId)
        if(params.projectId) qs.set('projectId', params.projectId)
        if(params.page) qs.set('page', params.page.toString())
        if(params.pageSize) qs.set('pageSize', params.pageSize.toString())

        return apiFetch<PaginatedResponse<RunWithSteps>>(`/api/runs?${qs.toString()}`)
    },

    get: (id:string) => apiFetch<any>(`/api/runs/${id}`),

    stats: (id: string) => apiFetch<any>(`/api/runs/${id}/stats`),

    trigger: (body: TriggerRunRequest) => apiFetch<{runId: string}>(`/api/runs`,{
        method: 'POST',
        body: JSON.stringify(body)
    }),

    conscel: (id: string) => apiFetch<void>(`/api/runs/${id}/cancel`, {
        method: 'POST'
    })
}



// ─────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────

export const logsApi = {
    list: (stepRunId: string, page = 1) => apiFetch<PaginatedResponse<any>>(`/api/logs/${stepRunId}?page=${page}&pageSize=500`),

    streamUrl: (stepRunId: string) => `${BASE}/api/logs/${stepRunId}/stream`,
    runStatusStreamUrl: (runId: string) => `${BASE}/api/runs/${runId}/status-stream`
}


// ─────────────────────────────────────────────────────────────
// Runners
// ─────────────────────────────────────────────────────────────

export const runnersApi = {
    list: () => apiFetch<any[]>('/api/runners')
}