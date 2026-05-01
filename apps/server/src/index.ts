import cors from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { foldersRoute } from './routes/folders';

const v1 = new Elysia({ prefix: '/v1' }).use(foldersRoute);

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
  .use(v1)
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
