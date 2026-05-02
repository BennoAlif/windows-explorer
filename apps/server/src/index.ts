import { opentelemetry } from "@elysia/opentelemetry";
import cors from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto/build/src/platform/node/OTLPTraceExporter";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { Elysia } from "elysia";
import { withErrorHandling } from "./plugins/error-handler";
import { foldersRoute } from "./routes/folders";
import { filesRoute } from "./routes/files";

const v1 = withErrorHandling(new Elysia({ prefix: "/v1" }))
	.use(foldersRoute)
	.use(filesRoute);

const app = withErrorHandling(new Elysia())
	.use(cors())
	.use(swagger({ path: "/docs" }))
	.use(
		opentelemetry({
			spanProcessors: [
				new BatchSpanProcessor(
					new OTLPTraceExporter({
						url: "http://localhost:4318/v1/traces",
					}),
				),
			],
		}),
	)
	.use(v1)
	.listen(3000);

console.log(
	`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
