import { opentelemetry } from "@elysia/opentelemetry";
import cors from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto/build/src/platform/node/OTLPTraceExporter";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { Elysia } from "elysia";
import { ok } from "types";
import { withErrorHandling } from "./plugins/error-handler";
import { foldersRoute } from "./routes/folders";
import { filesRoute } from "./routes/files";
import { searchRoute } from "./routes/search";

const v1 = withErrorHandling(new Elysia({ prefix: "/v1" }))
	.use(foldersRoute)
	.use(filesRoute)
	.use(searchRoute);

const port = Number(process.env.PORT ?? 3000);
const otlpTracesUrl =
	process.env.OTLP_TRACES_URL ?? "http://localhost:4318/v1/traces";

const app = withErrorHandling(new Elysia())
	.use(cors())
	.use(swagger({ path: "/docs" }))
	.use(
		opentelemetry({
			spanProcessors: [
				new BatchSpanProcessor(
					new OTLPTraceExporter({
						url: otlpTracesUrl,
					}),
				),
			],
		}),
	)
	.get("/", () => ok("Welcome to the Elysia API!"))
	.use(v1)
	.listen({
		hostname: "0.0.0.0",
		port,
	});

console.log(
	`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
