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
