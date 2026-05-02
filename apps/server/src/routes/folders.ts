import { Elysia, t } from "elysia";
import { FolderRepositoryImpl } from "../repositories/folder.repository";
import { FolderService } from "../services/folder.service";
import { ok } from "../types/api";
import { FileRepositoryImpl } from "../repositories/file.repository";
import { FileService } from "../services/file.service";

const folderService = new FolderService(
	new FolderRepositoryImpl(),
	new FileRepositoryImpl(),
);
const fileService = new FileService(
	new FileRepositoryImpl(),
	new FolderRepositoryImpl(),
);

export const foldersRoute = new Elysia({ prefix: "/folders" })
	.get("/", async () => ok(await folderService.getAll()))
	.get(
		"/:id/items",
		async ({ params }) => ok(await folderService.getItemsByFolderId(params.id)),
		{
			params: t.Object({ id: t.Number() }),
		},
	)
	.post("/", async ({ body }) => ok(await folderService.create(body)), {
		body: t.Object({
			name: t.String({ minLength: 1 }),
			parentId: t.Optional(t.Nullable(t.Number())),
		}),
	})
	.patch(
		"/:id",
		async ({ params, body }) => ok(await folderService.update(params.id, body)),
		{
			params: t.Object({ id: t.Number() }),
			body: t.Object({
				name: t.Optional(t.String({ minLength: 1 })),
				parentId: t.Optional(t.Nullable(t.Number())),
			}),
		},
	)
	.post(
		"/:folderId/files",
		async ({ params, body }) =>
			ok(await fileService.create(params.folderId, body)),
		{
			params: t.Object({ folderId: t.Number() }),
			body: t.Object({
				name: t.String({ minLength: 1 }),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params }) => {
			await folderService.delete(params.id);
			return ok(null);
		},
		{
			params: t.Object({ id: t.Number() }),
		},
	);
