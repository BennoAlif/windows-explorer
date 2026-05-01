import { afterEach, describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../src/errors';
import { foldersRoute } from '../../src/routes/folders';
import type { ApiResponse } from '../../src/types/api';
import { fail } from '../../src/types/api';
import type { Folder } from '../../src/types/folder';

const app = new Elysia({ prefix: '/v1' })
  .use(foldersRoute)
  .error({ NotFoundError, ConflictError, BadRequestError })
  .onError(({ code, error }) => {
    switch (code) {
      case 'NotFoundError':
      case 'ConflictError':
      case 'BadRequestError':
        return fail(error.message);
      case 'VALIDATION':
        return fail('Validation failed');
      default:
        return fail('Internal server error');
    }
  });

const BASE = 'http://localhost';

const post = (body: unknown) =>
  app.handle(
    new Request(`${BASE}/v1/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const createdIds: number[] = [];

afterEach(async () => {
  for (const id of createdIds.splice(0)) {
    await app.handle(
      new Request(`${BASE}/v1/folders/${id}`, { method: 'DELETE' }),
    );
  }
});

describe('GET /v1/folders', () => {
  it('returns 200', async () => {
    const res = await app.handle(new Request(`${BASE}/v1/folders`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Folder[]>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('POST /v1/folders', () => {
  it('creates a folder and returns 200', async () => {
    const res = await post({ name: `integration-${Date.now()}` });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<Folder>;
    expect(body.success).toBe(true);
    expect(typeof body.data?.id).toBe('number');
    if (body.data) createdIds.push(body.data.id);
  });

  it('returns 422 for empty name', async () => {
    const res = await post({ name: '' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for missing body', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v1/folders`, { method: 'POST' }),
    );
    expect(res.status).toBe(422);
  });
});

describe('GET /v1/folders/:id', () => {
  it('returns 200 for an existing folder', async () => {
    const createRes = await post({ name: `integration-get-${Date.now()}` });
    const created = (await createRes.json()) as ApiResponse<Folder>;
    if (!created.data) throw new Error('Expected created folder data');
    const id = created.data.id;
    createdIds.push(id);

    const res = await app.handle(new Request(`${BASE}/v1/folders/${id}`));
    expect(res.status).toBe(200);
  });

  it('returns 404 for a non-existing folder', async () => {
    const res = await app.handle(new Request(`${BASE}/v1/folders/999999`));
    expect(res.status).toBe(404);
  });

  it('returns 422 for a non-numeric id', async () => {
    const res = await app.handle(new Request(`${BASE}/v1/folders/abc`));
    expect(res.status).toBe(422);
  });
});

describe('PATCH /v1/folders/:id', () => {
  it('updates a folder and returns 200', async () => {
    const createRes = await post({ name: `integration-patch-${Date.now()}` });
    const created = (await createRes.json()) as ApiResponse<Folder>;
    if (!created.data) throw new Error('Expected created folder data');
    const id = created.data.id;
    createdIds.push(id);

    const res = await app.handle(
      new Request(`${BASE}/v1/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `integration-patched-${Date.now()}` }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 for a non-existing folder', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v1/folders/999999`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X' }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /v1/folders/:id', () => {
  it('deletes a folder and returns 200', async () => {
    const createRes = await post({ name: `integration-delete-${Date.now()}` });
    const created = (await createRes.json()) as ApiResponse<Folder>;
    if (!created.data) throw new Error('Expected created folder data');
    const id = created.data.id;
    // don't push to createdIds — already being deleted

    const res = await app.handle(
      new Request(`${BASE}/v1/folders/${id}`, { method: 'DELETE' }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 for a non-existing folder', async () => {
    const res = await app.handle(
      new Request(`${BASE}/v1/folders/999999`, { method: 'DELETE' }),
    );
    expect(res.status).toBe(404);
  });
});
