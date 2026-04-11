// ─────────────────────────────────────────────────────────────
// Re-export Prisma enums so the frontend never imports from @prisma/client directly
// ─────────────────────────────────────────────────────────────

export type {
    User,
    Organization,
    OrgMember,
    Project,
    Pipeline,
    Run,
    StepRun,
    LogChunk,
    Artifact,
    Runner,
    WebHookEvent,
    AuditLog
} from "db"

export {
    RunStatus,
    TriggerType,
    RunnerStatus,
    LogStream,
    WebHookEventStatus,
    UserRole,
    OrgRole
} from "db"


// ─────────────────────────────────────────────────────────────
// YAML Pipeline Definition (parsed from yamlConfig string)
// ─────────────────────────────────────────────────────────────

export interface StepDef {
    name: string
    image: string
    commands: string[]
    dependsOn: string[]
    env?: Record<string,string>
    timeout?: number
    continueOnError?: boolean
}

export interface PipelineDef {
    name: string
    steps: StepDef[]
    env?: Record<string,string>
}


// ─────────────────────────────────────────────────────────────
// DAG types
// ─────────────────────────────────────────────────────────────

export interface DagNode {
    name: string
    dependsOn: string[]
    dependents: string[]
    depth: number
}

export type DagGraph = Record<string, DagNode>


// ─────────────────────────────────────────────────────────────
// Redis Stream message payloads
// ─────────────────────────────────────────────────────────────

export interface JobMessage {
    runId: string
    stepRunId: string
    stepName: string
    image: string
    commands: string[]
    env: Record<string,string>
    timeoutSeconds: number
}

export interface StepCompleteMessage {
    runId: string
    stepRunId: string
    stepName: string
    exitCode: number
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
}


// ─────────────────────────────────────────────────────────────
// API Request / Response shapes
// ─────────────────────────────────────────────────────────────

export interface LoginRequest {
    email: string
    password: string
}

export interface LoginResponse {
    token: string
    user: SafeUser
}

export interface SafeUser {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
    role: string
}

//Projects
export interface CreateProjectRequest {
    name: string
    slug: string
    repoUrl?: string
    description?: string
    orgId: string
}

//Pipeline
export interface CreatePipelineRequest {
    name: string
    description?: string
    yamlConfig: string
    trigger: string
    branch?: string
    cronExpr?: string
    projectId: string
}

export interface UpdatePipelineRequest {
    name?: string
    description?: string
    yamlConfig?: string
    trigger?: string
    branch?: string
    cronExpr?: string
    isActive?: boolean
}

// Runs

export interface TriggerRunRequest {
    pipelineId: string
    commitSha?: string
    commitMsg?: string
    branch?: string
}

export interface RunWithSteps {
    id: string
    status: string
    triggerType: string
    commitSha: string | null
    commitMsg: string | null
    branch: string | null
    triggeredBy: string | null
    startedAt: Date | null
    finishedAt: Date | null
    createdAt: Date | null
    pipeline: {
        id: string
        name: string
    }
    stepsRun: StepRunSummary[]
}

export interface StepRunSummary {
    id: string
    name: string
    status: string
    image: string
    exitCode: number
    startedAt: Date | null
    createdAt: Date | null
    runnerId: string | null
}

// SSE log event shape
export interface LogEvent {
    stepRunId: string
    seq: number
    text: string
    stream: 'STDOUT' | 'STDERR'
}


// ─────────────────────────────────────────────────────────────
// Pagination wrapper
// ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
    data: []
    total: number
    page: number
    pageSize: number
    hasMore: boolean
}


// ─────────────────────────────────────────────────────────────
// Generic API response envelope
// ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
    message?: string
}