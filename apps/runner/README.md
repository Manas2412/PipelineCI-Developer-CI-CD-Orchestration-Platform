# PipelineCI — Runner Service

The `runner` package is the execution engine of the PipelineCI platform. It listens for pending jobs on **Redis Streams**, manages isolated Docker environments, and streams real-time execution logs back to the database.

## 🚀 Key Features

- **Isolated Execution**: Each pipeline step runs in a dedicated [Dockerode](https://github.com/apocas/dockerode) managed container for maximum security and reproducibility.
- **Real-Time Log Streaming**: Captures and streams `stdout` and `stderr` as they occur into PostgreSQL and optionally to the Frontend via Redis Pub/Sub.
- **Retry Mechanism**: Built-in support for job acknowledgment and error-aware retries on failure.
- **Horizontal Scalability**: Stateless architecture allows multiple runners to be deployed across different host machines for higher throughput.

## 🛠️ Technology Stack

- **Runtime**: [Bun](https://bun.sh) / Node.js
- **Containerization**: [Docker](https://www.docker.com)
- **Job Consumption**: [Redis Streams](https://redis.io/docs/data-types/streams/)
- **Database Backend**: [Prisma](https://prisma.io) with PostgreSQL

## 📋 Prerequisites

- **Docker Desktop**: The Runner requires an active Docker daemon connection to pull and run images.
- **Redis Server**: Must be reachable for the Runner to consume jobs.
- **Node/Bun Runtime**: Installed at version 18+.

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

## 🏗️ Technical Specification

The Runner consumes from the `jobs:new` group in the `jobs` stream. It follows a multi-step execution cycle:
1.  **Job Acknowledgment**: Marks the job as being processed.
2.  **Environment Preparation**: Pulls necessary Docker images based on the pipeline YAML.
3.  **Step Execution**: Spawns containers for each required step.
4.  **Log capture**: Demuxes container output and persists log chunks.
5.  **Status Reporting**: Updates `StepRun` and `Run` status in the DB based on exit codes.

---
Part of the [PipelineCI](https://github.com/Manas2412/PipelineCI-Developer-CI-CD-Orchestration-Platform) platform.
