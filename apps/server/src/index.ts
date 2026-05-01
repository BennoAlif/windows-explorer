import cors from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { foldersRoute } from './routes/folders';
import { ConflictError, NotFoundError, BadRequestError } from './errors';
import { fail } from './types/api';
import { opentelemetry } from '@elysia/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto/build/src/platform/node/OTLPTraceExporter';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

const v1 = new Elysia({ prefix: '/v1' }).use(foldersRoute);

const app = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
  .use(
    opentelemetry({
      spanProcessors: [
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: 'http://localhost:4318/v1/traces',
          }),
        ),
      ],
    }),
  )
  .use(v1)
  .listen(3000);

app
  .error({ NotFoundError, ConflictError, BadRequestError })
  .onError(({ code, error }) => {
    switch (code) {
      case 'NotFoundError':
        return fail(error.message);
      case 'ConflictError':
        return fail(error.message);
      case 'BadRequestError':
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
