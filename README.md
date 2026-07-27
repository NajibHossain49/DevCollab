# DevCollab

Real-time collaborative code editor — Turborepo monorepo.

> **Status:** Phase 1 (Backend). Project scaffold only — no business logic yet.

## Structure

```
devcollab/
├── apps/
│   └── ws-server/        # Node.js + Express + TypeScript backend
├── packages/
│   └── shared-types/     # Shared TypeScript types (backend + frontend)
├── turbo.json            # Turborepo task pipeline
├── tsconfig.base.json    # Shared strict TypeScript config
└── package.json          # npm workspaces root
```

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js 4.x
- **Language:** TypeScript (strict)
- **ORM:** Prisma
- **Validation:** Zod
- **Logging:** Pino
- **Build:** tsup
- **Dev runner:** tsx
- **Monorepo:** Turborepo

## Getting Started

```bash
# Install all workspace dependencies
npm install

# Copy backend env template
cp apps/ws-server/.env.example apps/ws-server/.env

# Run everything in dev mode
npm run dev
```

## Common Commands

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `npm run build`     | Build all packages/apps via Turbo    |
| `npm run dev`       | Run all apps in watch mode           |
| `npm run test`      | Run tests across the workspace       |
| `npm run lint`      | Lint the workspace                   |
| `npm run typecheck` | Type-check the workspace             |
