import { Elysia, t } from "elysia";
import { FileRepositoryImpl } from "../repositories/file.repository";
import { FileService } from "../services/file.service";
import { FolderRepositoryImpl } from "../repositories/folder.repository";
import { ok } from "../types/api";

const service = new FileService(
	new FileRepositoryImpl(),
	new FolderRepositoryImpl(),
);

export const filesRoute = new Elysia({ prefix: "/files" })
	.patch(
		"/:id",
		async ({ params, body }) => ok(await service.update(params.id, body)),
		{
			params: t.Object({ id: t.Number() }),
			body: t.Object({
				name: t.Optional(t.String({ minLength: 1 })),
				folderId: t.Optional(t.Number()),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params }) => {
			await service.delete(params.id);
			return ok(null);
		},
		{
			params: t.Object({ id: t.Number() }),
		},
	);
