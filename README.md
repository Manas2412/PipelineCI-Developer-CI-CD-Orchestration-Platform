# PipelineCI

PipelineCI is a high-performance, developer-centric CI/CD orchestration platform designed for isolation, speed, and real-time visibility. It enables developers to define complex multi-step pipelines as code and execute them in isolated Docker containers with live log streaming.

## 🌟 Core Features

- **Isolated execution**: Each pipeline step runs in its own Docker container.
- **Real-time Logs**: Live streaming of stdout/stderr from containers to the dashboard.
- **DAG-based Scheduling**: Smart dependency tracking between pipeline steps.
- **Redis-powered Queue**: High-throughput job scheduling using Redis Streams.
- **Multi-tenant**: Built-in support for Organizations and Teams.
- **Webhooks**: Native integration for automated triggers from VCS providers.

## 🏗️ Architecture

PipelineCI is built as a monorepo using **Turborepo** and **Bun**:

- **`apps/api`**: Fastify control plane for managing projects, auth, and job admission.
- **`apps/runner`**: Execution engine that consumes jobs and manages Docker lifecycles.
- **`apps/web`**: (WIP) Modern frontend for pipeline visualization and management.
- **`packages/db`**: Centralized Prisma ORM and schema definitions.
- **`packages/types`**: Shared TypeScript definitions and Zod schemas.

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Primary Language**: TypeScript
- **Framework**: [Fastify](https://fastify.io)
- **Database**: [PostgreSQL](https://postgresql.org)
- **Cache/Queue**: [Redis](https://redis.io)
- **Compute**: [Docker](https://docker.com)

## 📦 Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine active.

### Installation

```bash
bun install
```

### Infrastructure Setup

Start the required Postgres and Redis instances:

```bash
docker-compose up -d
```

### Database Initialization

```bash
# Push schema to database
cd packages/db && bun run db:push
```

### Running Locally

To start all services (API and Runner) in development mode:

```bash
bun run dev
```

## 📜 Repository Structure

```text

pipelineci/
├── .env.example
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── packages/
│   ├── db/          index.ts  package.json
│   ├── types/       index.ts  package.json
│   └── redis/       index.ts  package.json
├── apps/
│   ├── api/src/
│   │   ├── index.ts                  ← Fastify entry
│   │   ├── lib/dag.ts                ← YAML parser + DAG resolver
│   │   ├── lib/queue.ts              ← Redis Streams producer
│   │   ├── lib/scheduler.ts          ← DAG-aware orchestrator
│   │   └── routes/
│   │       ├── auth.ts
│   │       ├── pipelines.ts
│   │       ├── runs.ts
│   │       ├── logs.ts (SSE)
│   │       └── projects.ts + runners
│   ├── runner/src/index.ts           ← Docker runner process
│   └── web/src/
│       ├── app/layout.tsx + providers.tsx + globals.css
│       ├── app/(auth)/login/page.tsx
│       ├── app/(app)/dashboard/page.tsx
│       ├── app/(app)/projects/[id]/page.tsx
│       ├── app/(app)/pipelines/[id]/edit/page.tsx  ← Monaco + React Flow
│       ├── app/(app)/runs/[id]/page.tsx             ← Gantt + SSE logs
│       ├── app/(app)/runners/page.tsx
│       ├── components/ui.tsx
│       ├── components/layout.tsx
│       ├── lib/api.ts
│       ├── lib/store.ts
│       └── lib/hooks.ts
Built with ❤️ for developers who love automation.





# PipelineCI

A self-hosted CI/CD orchestration platform. Define pipelines in YAML, run jobs in isolated Docker containers across a worker pool, and watch logs stream live.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind · TanStack Query · React Flow · Monaco |
| API | Fastify · TypeScript · Zod · JWT |
| Database | PostgreSQL · Prisma ORM |
| Queue | Redis Streams (job bus) · Redis pub/sub (live logs) |
| Runner | Node.js · Dockerode |
| Monorepo | Turborepo · pnpm workspaces |

## Structure

```
pipelineci/
├── apps/
│   ├── api/          Fastify REST API + DAG scheduler
│   ├── runner/       Docker job runner process
│   └── web/          Next.js dashboard
└── packages/
    ├── db/           Prisma schema + client
    ├── redis/        Shared Redis client + key helpers
    ├── tsconfig/     Shared TypeScript configs
    └── types/        Shared TypeScript interfaces
```

## Getting started

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 8
- Docker (for infra and job execution)

### 1. Clone and install

```bash
git clone https://github.com/Manas2412/PipelineCI-Developer-CI-CD-Orchestration-Platform
cd PipelineCI-Developer-CI-CD-Orchestration-Platform
pnpm install
```

### 2. Start infrastructure

```bash
pnpm infra:up        # starts Postgres + Redis via docker-compose
```

### 3. Set up environment

```bash
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET
```

### 4. Run database migrations

```bash
pnpm db:migrate      # runs prisma migrate dev
pnpm db:generate     # generates Prisma client
```

### 5. Start everything

```bash
# Terminal 1 — API + Web (runs in parallel via Turbo)
pnpm dev

# Terminal 2 — Runner process
pnpm runner
```

Open [http://localhost:3000](http://localhost:3000) and register an account.

## Pipeline YAML format

```yaml
name: Build and Deploy

env:
  NODE_ENV: production

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
    dependsOn: [install]      # parallel with test
    commands:
      - npm run build

  - name: deploy
    image: bitnami/kubectl:latest
    dependsOn: [test, build]  # fan-in gate
    commands:
      - kubectl rollout restart deploy/my-app
```

`dependsOn` builds a DAG — steps with satisfied dependencies run in parallel across the runner pool.

## Key architectural decisions

- **Redis Streams** as the job bus — consumer groups ensure each job is picked up by exactly one runner. Dead-letter handling via `XPENDING` + re-delivery on restart.
- **Redis pub/sub** for live log streaming — runner publishes each stdout/stderr line; the API SSE endpoint subscribes and forwards to the browser in real-time. Historical logs are persisted to Postgres and replayed on reconnect.
- **Distributed step lock** — `SET lock:step:<id> NX EX 300` prevents two runners racing the same job during high-concurrency scenarios.
- **DAG self-relation** on `StepRun` — dependency edges stored in Postgres. Scheduler queries completed deps on every step-complete event to determine which steps to unblock next.
- **Turborepo shared packages** — `@pipelineci/types` is imported by both the API and the frontend, giving end-to-end type safety with zero duplication.

## Webhook setup (GitHub)

1. Go to your GitHub repo → Settings → Webhooks → Add webhook
2. Payload URL: `http://your-server:3001/api/projects/<projectId>/webhook`
3. Content type: `application/json`
4. Secret: copy from Project Settings → Webhook secret
5. Events: select **Push** and/or **Pull requests**

## License

MIT
