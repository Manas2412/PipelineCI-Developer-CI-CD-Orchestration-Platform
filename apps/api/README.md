# PipelineCI — API Service

The `api` package is the core control plane of the PipelineCI orchestration platform. It manages authentication, project configurations, webhook intake, and job scheduling.

## 🚀 Key Features

- **Project Management**: CRUD operations for organizations, projects, and pipelines.
- **Webhook Processing**: Securely receives and verifies webhooks from GitHub/GitLab to trigger CI runs.
- **Job Scheduling**: Uses **Redis Streams** to push work to available runners in real-time.
- **Audit Logging**: Comprehensive tracking of all organizational and project-level activities.
- **Authentication**: JWT-based secure access for all endpoints.

## 🛠️ Technology Stack

- **Runtime**: [Bun](https://bun.sh) / Node.js
- **Framework**: [Fastify](https://fastify.io)
- **Database**: [Prisma](https://prisma.io) with PostgreSQL
- **Caching/Queue**: [Redis](https://redis.io)

## 📋 Prerequisites

- **Docker**: For running PostgreSQL and Redis (via `docker-compose` at the root).
- **Environment Variables**: Configure your `.env` based on `.env.example`.

## 📦 Getting Started

### Installation
```bash
npm install
# or
bun install
```

### Development
```bash
npm run dev
```

### Database Management
Scripts for database management are centralized in the `db` package, but you can interact via:
```bash
npx prisma studio --schema=../../packages/db/prisma/schema.prisma
```

## 🏗️ Architecture Note
The API service acts as a producer for the Runner service. It persists the initial state of a `Run` and `StepRun` in PostgreSQL before queuing the job for the Runner to process via Redis.

---
Part of the [PipelineCI](https://github.com/Manas2412/PipelineCI-Developer-CI-CD-Orchestration-Platform) platform.
