import { Elysia, t } from 'elysia';
import { FolderRepositoryImpl } from '../repositories/folder.repository';
import { FolderService } from '../services/folder.service';
import { ok } from '../types/api';

const service = new FolderService(new FolderRepositoryImpl());

export const foldersRoute = new Elysia({ prefix: '/folders' })
  .get('/', async () => ok(await service.getAll()))
  .get(
    '/:id/children',
    async ({ params }) => ok(await service.getByParentId(params.id)),
    {
      params: t.Object({ id: t.Number() }),
    },
  )
  .post('/', async ({ body }) => ok(await service.create(body)), {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      parentId: t.Optional(t.Nullable(t.Number())),
    }),
  })
  .patch(
    '/:id',
    async ({ params, body }) => ok(await service.update(params.id, body)),
    {
      params: t.Object({ id: t.Number() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        parentId: t.Optional(t.Nullable(t.Number())),
      }),
    },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await service.delete(params.id);
      return ok(null);
    },
    {
      params: t.Object({ id: t.Number() }),
    },
  );
