# Load testing

This directory contains k6 scenarios for measuring the Bun/Elysia API against
Postgres data. These tests are a baseline discovery harness: they expose latency,
error rate, and throughput under load, but they do not prove the service can
survive millions of rows or thousands of concurrent users without interpreting the
results and profiling the database/server.

## Prerequisites

Install k6 outside of the monorepo:

```bash
brew install k6
```

You can also run k6 with Docker or install it from the official k6 packages.

Start the local dependencies and prepare the database:

```bash
docker compose up -d postgres jaeger
bun run db:push
```

## Seed performance data

The load seed script inserts predictable folder and file names for browsing and
searching. Defaults are safe for local use.

```bash
bun run load:seed
```

Useful knobs:

```bash
ROOT_FOLDERS=100 FOLDERS_PER_ROOT=100 FILES_PER_FOLDER=100 BATCH_SIZE=1000 LOAD_SEED_TOKEN=perf bun run load:seed
```

The generated names include `perf-root`, `perf-folder`, and `perf-file`, which
are the default k6 search terms. Use a new `LOAD_SEED_TOKEN` when seeding the
same database more than once.

## Run scenarios

Start the server:

```bash
bun run dev:server
```

Run a short smoke check:

```bash
bun run load:test:smoke
```

Run the default baseline profile:

```bash
bun run load:test
```

Useful k6 knobs:

```bash
BASE_URL=http://localhost:3000 TARGET_VUS=200 HOLD_DURATION=5m P95_MS=3000 bun run load:test
```

The full workflow scenario:

- lists root folders,
- opens a root folder,
- searches seeded terms,
- creates a source and destination folder,
- creates a file,
- renames and moves the file,
- renames the folder,
- deletes only resources created during that iteration.

## Reading results

The default thresholds are intentionally relaxed for baseline discovery:

- `http_req_failed < 1%`
- `http_req_duration p95 < 2000ms`
- `checks > 99%`

If these fail, inspect server logs, Postgres metrics, and slow queries before
raising concurrency. The recursive search endpoint is expected to be one of the
most important paths to profile with large data.
