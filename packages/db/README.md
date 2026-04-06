# PipelineCI — Database Package

The `db` package is a shared internal package that provides type-safe database access via **Prisma** to all other services in the monorepo.

## 🚀 Key Features

- **Centralized Schema**: Single `schema.prisma` defines the source of truth for the entire platform.
- **Type Safety**: Automatically generates and exports a `PrismaClient` that is consumed by `api` and `runner`.
- **Pre-configured Middleware**: Initialized as a singleton to prevent connection leaks during development.
- **Support for All Drivers**: Configured to work natively with Bun or Node.js via the `prisma-client-js` provider.

## 🛠️ Technology Stack

- **ORM**: [Prisma](https://prisma.io)
- **Database**: [PostgreSQL](https://postgresql.org)
- **Engine**: [Native Library](https://pris.ly/d/client-engines) (for maximum performance)

## 📋 Common Management Commands

Ensure you are in the `packages/db` directory or using the root-level scripts if configured.

### Re-generate Client
```bash
npm run db:generate
```

### Apply Migrations
```bash
npm run db:migrate
```

### Sync Schema with Local DB (no migrations)
```bash
npm run db:push
```

### Interactive Data Explorer
```bash
npm run db:studio
```

## 🏗️ Technical Specification

The package exposes the `prisma` object as a singleton via `globalThis` to maintain only a single connection pool per process during hot-reloads (`npm run dev`).

---
Part of the [PipelineCI](https://github.com/Manas2412/PipelineCI-Developer-CI-CD-Orchestration-Platform) platform.
