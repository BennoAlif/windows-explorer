import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import cors from '@elysiajs/cors';
import { foldersRoute } from '../../src/routes/folders';
import type { Folder } from '../../src/types/folder';

const BASE = 'http://localhost:4000';

let app: ReturnType<typeof Elysia.prototype.listen>;

beforeAll(() => {
  app = new Elysia()
    .use(cors())
    .use(new Elysia({ prefix: '/v1' }).use(foldersRoute))
    .listen(4000);
});

afterAll(() => app.stop());

describe('Folders E2E', () => {
  it('GET /v1/folders returns array', async () => {
    const res = await fetch(`${BASE}/v1/folders`);
    const data = (await res.json()) as Folder[];
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});
