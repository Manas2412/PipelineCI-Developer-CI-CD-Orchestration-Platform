# PipelineCI 🚀

PipelineCI is a high-performance, developer-first CI/CD orchestration platform. Built for modern monorepos, it provides visual pipeline management, real-time log streaming, and blazing-fast execution using Bun.

![PipelineCI Landing Page](/apps/web/public/hero.png)

## 📋 Features

- **Visual DAG Pipelines**: Understand your build dependencies with an interactive Directed Acyclic Graph.
- **Bun-Native**: Optimized for Bun v1.x, delivering significantly faster install and test cycles.
- **Real-Time Logs**: Watch your builds execute in real-time with high-performance streaming.
- **Monorepo Ready**: Designed to handle complex, large-scale codebases with ease.
- **Declarative YAML**: Simple, version-controlled pipeline definitions.

## 🏗️ Project Structure

This is a monorepo managed with **Turborepo** and **Bun Workspaces**:

- `apps/api`: Fastify-based backend managing pipelines, runs, and orchestration.
- `apps/runner`: The execution engine that runs pipeline steps in isolated Docker containers.
- `apps/web`: Next.js dashboard for visualizing and managing your CI/CD.
- `packages/db`: Shared Prisma client and database schema.
- `packages/redis`: Shared Redis client and queue logic.
- `packages/types`: Shared TypeScript definitions across the monorepo.

## 📁 Project Structure

```text
.
├── apps/
│   ├── api/          # Fastify Backend & Orchestrator
│   ├── runner/       # Docker Step Execution Engine
│   └── web/          # Next.js Dashboard Frontend
├── packages/
│   ├── db/           # Prisma Client & PostgreSQL Schema
│   ├── redis/        # Redis Clients & Key Helpers
│   ├── types/        # Shared TypeScript Types
│   ├── ui/           # Shared UI Components
│   └── eslint-config/# Shared Linting Config
├── docker-compose.yml
├── turbo.json        # Turborepo Configuration
└── package.json      # Root Mono-repo workspace
```

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.3 or higher)
- [Docker](https://www.docker.com) (for running pipeline steps)
- [PostgreSQL](https://www.postgresql.org)
- [Redis](https://redis.io)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Manas2412/PipelineCI-Developer-CI-CD-Orchestration-Platform.git
   cd PipelineCI
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Setup environment variables:
   Create a `.env` file in the root directory (see `.env-sample` for required variables).

4. Initialize the database:
   ```bash
   bun run db:generate
   bun run db:push
   ```

5. Start the development environment:
   ```bash
   bun run dev
   ```

The dashboard will be available at `http://localhost:3000` and the API at `http://localhost:3001`.

## 🐳 Docker Infrastructure

PipelineCI uses Docker to provision its core infrastructure. You can start the required services (PostgreSQL and Redis) using:

```bash
docker-compose up -d
```

| Service | Image | Host Port | Internal Port |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | `postgres:16-alpine` | `5433` | `5432` |
| **Redis** | `redis:7-alpine` | `6379` | `6379` |

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, React Flow, TanStack Query.
- **Backend**: Fastify, Prisma, PostgreSQL.
- **Orchestration**: Redis Streams for job queuing and DAG management.
- **Execution**: Docker Engine API for isolated environment runs.

## 📜 License

© [Manas Sisodia](https://github.com/Manas2412)
