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