import cors from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia, ValidationError } from 'elysia';
import { foldersRoute } from './routes/folders';
import { ConflictError, NotFoundError } from './errors';
import { fail } from './types/api';

const v1 = new Elysia({ prefix: '/v1' }).use(foldersRoute);

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
  .use(v1)
  .listen(3000);

app.error({ NotFoundError, ConflictError }).onError(({ code, error }) => {
  switch (code) {
    case 'NotFoundError':
    case 'ConflictError':
      return fail(error.message);
    case 'VALIDATION':
      return fail('Validation failed');
    default:
      return fail('Internal server error');
  }
});

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
