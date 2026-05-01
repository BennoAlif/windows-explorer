import { describe, it, expect } from 'bun:test';
import { Elysia } from 'elysia';
import { foldersRoute } from '../../src/routes/folders';

// Uses Elysia's built-in .handle() — no real server needed
const app = new Elysia({ prefix: '/v1' }).use(foldersRoute);

describe('GET /v1/folders', () => {
  it('returns 200', async () => {
    const res = await app.handle(
      new Request('http://localhost:3000/v1/folders'),
    );
    expect(res.status).toBe(200);
  });
});
