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

Run the default production-like baseline profile:

```bash
bun run load:test
```

This profile approximates normal file-explorer usage:

- 70% browse/open-folder
- 20% search
- 10% create/update/delete workflow

Run the previous write-heavy full workflow as a stress test:

```bash
K6_PROFILE=stress bun run load:test
```

Run diagnostic profiles to isolate read or write bottlenecks:

```bash
K6_PROFILE=read-heavy bun run load:test
K6_PROFILE=write-heavy bun run load:test
```

Useful k6 knobs:

```bash
BASE_URL=http://localhost:3000 TARGET_VUS=200 HOLD_DURATION=5m P95_MS=3000 bun run load:test
```

Available profiles:

- `production`: realistic mixed traffic, and the default for `bun run load:test`.
- `stress`: lists folders, opens a folder, searches, creates folders/files, updates, moves, and cleans up every iteration.
- `read-heavy`: only browse/open-folder and search traffic.
- `write-heavy`: only create/update/delete traffic.
- `smoke`: short production-like validation used by `bun run load:test:smoke`.

Write workflows delete only resources created during that iteration.

## Reading results

The default thresholds are intentionally relaxed for baseline discovery:

- `http_req_failed < 1%`
- `http_req_duration p95 < 2000ms`
- `checks > 99%`

The scenario tags each request by workflow step, so k6 also prints endpoint-level
thresholds such as:

- `http_req_duration{name:list_root_folders}`
- `http_req_duration{name:open_folder_items}`
- `http_req_duration{name:search_seeded_data}`
- `http_req_duration{name:create_folder}`
- `http_req_duration{name:create_file}`
- `http_req_duration{name:update_file}`
- `http_req_duration{name:update_folder}`
- `http_req_duration{name:cleanup}`

Each HTTP request also carries a `profile` tag, so detailed outputs can separate
production-like traffic from stress or diagnostic runs.

Use these tagged p95 lines to find which endpoint owns the slow tail. You can set
separate thresholds when needed:

```bash
SEARCH_P95_MS=5000 WRITE_P95_MS=1000 TARGET_VUS=100 bun run load:test
```

If these fail, inspect server logs, Postgres metrics, and slow queries before
raising concurrency. Search is expected to be one of the most important paths to
profile with large data.
