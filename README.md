# Windows Explorer

A Bun workspace with a Vue web app, an Elysia API server, and a Drizzle/PostgreSQL database package.

## Requirements

- [Bun](https://bun.sh)
- PostgreSQL

## Install

```bash
bun install
```

## Run With Docker Compose

Build and start the local stack with Docker Compose:

```bash
POSTGRES_PASSWORD=windows-explorer docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

## Database

The local database URL defaults to:

```bash
postgresql://windows-explorer:windows-explorer@localhost:5433/windows-explorer
```

Run migrations and optionally seed data:

```bash
bun run db:migrate
bun run db:seed
```

## Run In Development

Start the web app and API server together:

```bash
bun run dev
```

Or run them separately:

```bash
bun run dev:server
bun run dev:web
```

Default local URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`

## Other Commands

```bash
bun run build
bun run test
bun run lint
bun run typecheck
```
