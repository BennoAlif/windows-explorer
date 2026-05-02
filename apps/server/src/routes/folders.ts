import { Elysia, t } from "elysia";
import { FileRepositoryImpl } from "../repositories/file.repository";
import { FolderRepositoryImpl } from "../repositories/folder.repository";
import { FileService } from "../services/file.service";
import { FolderService } from "../services/folder.service";
import { ok } from "../types/api";

const folderService = new FolderService(new FolderRepositoryImpl());
const fileService = new FileService(
	new FileRepositoryImpl(),
	new FolderRepositoryImpl(),
);

export const foldersRoute = new Elysia({ prefix: "/folders" })
	.get(
		"/",
		async ({ query }) =>
			ok(
				await folderService.getAll({
					limit: query.limit,
					cursor: query.cursor,
				}),
			),
		{
			query: t.Object({
				limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
				cursor: t.Optional(t.String({ minLength: 1 })),
			}),
		},
	)
	.get(
		"/:id/items",
		async ({ params, query }) =>
			ok(
				await folderService.getItemsByFolderId(params.id, {
					limit: query.limit,
					cursor: query.cursor,
				}),
			),
		{
			params: t.Object({ id: t.Number() }),
			query: t.Object({
				limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
				cursor: t.Optional(t.String({ minLength: 1 })),
			}),
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
