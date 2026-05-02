import { afterEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { withErrorHandling } from "../../src/plugins/error-handler";
import { filesRoute } from "../../src/routes/files";
import { foldersRoute } from "../../src/routes/folders";
import { searchRoute } from "../../src/routes/search";
import type { ApiErrorDetail, ApiResponse } from "../../src/types/api";
import type { FileEntity } from "../../src/types/file";
import type { Folder } from "../../src/types/folder";
import type { SearchResult } from "../../src/types/search";

const app = withErrorHandling(new Elysia({ prefix: "/v1" }))
	.use(foldersRoute)
	.use(filesRoute)
	.use(searchRoute);

const BASE = "http://localhost";

const postFolder = (body: unknown) =>
	app.handle(
		new Request(`${BASE}/v1/folders`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

const postFile = (folderId: Folder["id"], body: unknown) =>
	app.handle(
		new Request(`${BASE}/v1/folders/${folderId}/files`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

const patchFolder = (id: Folder["id"], body: unknown) =>
	app.handle(
		new Request(`${BASE}/v1/folders/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

const patchFile = (id: FileEntity["id"], body: unknown) =>
	app.handle(
		new Request(`${BASE}/v1/files/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

const deleteFile = (id: FileEntity["id"]) =>
	app.handle(new Request(`${BASE}/v1/files/${id}`, { method: "DELETE" }));

const search = async (query: string) => {
	const res = await app.handle(
		new Request(`${BASE}/v1/search?q=${encodeURIComponent(query)}`),
	);
	expect(res.status).toBe(200);
	const body = (await res.json()) as ApiResponse<SearchResult>;
	if (!body.data) throw new Error("Expected search result data");
	return body.data;
};

const expectErrorResponse = async (
	res: Response,
	status: number,
	code: string,
	message: string,
	details?: ApiErrorDetail[],
) => {
	expect(res.status).toBe(status);
	const body = (await res.json()) as ApiResponse<null>;
	expect(body).toEqual({
		success: false,
		data: null,
		error: {
			code,
			message,
			...(details ? { details } : {}),
		},
	});
};

const createdIds: number[] = [];

afterEach(async () => {
	for (const id of createdIds.splice(0).reverse()) {
		await app.handle(
			new Request(`${BASE}/v1/folders/${id}`, { method: "DELETE" }),
		);
	}
});

describe("GET /v1/search", () => {
	it("globally searches folders and files with recursive paths", async () => {
		const token = `integration-search-${Date.now()}`;

		const rootRes = await postFolder({ name: `${token}-root` });
		const root = (await rootRes.json()) as ApiResponse<Folder>;
		if (!root.data) throw new Error("Expected root folder data");
		createdIds.push(root.data.id);

		const childRes = await postFolder({
			name: `${token}-child`,
			parentId: root.data.id,
		});
		const child = (await childRes.json()) as ApiResponse<Folder>;
		if (!child.data) throw new Error("Expected child folder data");
		createdIds.push(child.data.id);

		const fileRes = await postFile(child.data.id, {
			name: `${token}-notes.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const res = await app.handle(new Request(`${BASE}/v1/search?q=${token}`));
		expect(res.status).toBe(200);

		const body = (await res.json()) as ApiResponse<SearchResult>;
		expect(body.success).toBe(true);
		expect(body.data?.nextCursor).toBeNull();
		expect(
			body.data?.items.some(
				(item) =>
					item.type === "folder" &&
					item.id === child.data?.id &&
					item.path === `/${token}-root/${token}-child`,
			),
		).toBe(true);
		expect(
			body.data?.items.some(
				(item) =>
					item.type === "file" &&
					item.id === file.data?.id &&
					item.path === `/${token}-root/${token}-child/${token}-notes.txt`,
			),
		).toBe(true);
	});

	it("paginates global search results with a cursor", async () => {
		const token = `integration-cursor-${Date.now()}`;

		const rootRes = await postFolder({ name: `${token}-root` });
		const root = (await rootRes.json()) as ApiResponse<Folder>;
		if (!root.data) throw new Error("Expected root folder data");
		createdIds.push(root.data.id);

		const childRes = await postFolder({
			name: `${token}-child`,
			parentId: root.data.id,
		});
		const child = (await childRes.json()) as ApiResponse<Folder>;
		if (!child.data) throw new Error("Expected child folder data");
		createdIds.push(child.data.id);

		await postFile(child.data.id, { name: `${token}-a.txt` });
		await postFile(child.data.id, { name: `${token}-b.txt` });

		const firstRes = await app.handle(
			new Request(`${BASE}/v1/search?q=${token}&limit=1`),
		);
		expect(firstRes.status).toBe(200);

		const firstBody = (await firstRes.json()) as ApiResponse<SearchResult>;
		expect(firstBody.data?.items).toHaveLength(1);
		expect(typeof firstBody.data?.nextCursor).toBe("string");

		const firstItem = firstBody.data?.items[0];
		const cursor = firstBody.data?.nextCursor;
		if (!firstItem || !cursor) throw new Error("Expected first page cursor");

		const secondRes = await app.handle(
			new Request(
				`${BASE}/v1/search?q=${token}&limit=1&cursor=${encodeURIComponent(cursor)}`,
			),
		);
		expect(secondRes.status).toBe(200);

		const secondBody = (await secondRes.json()) as ApiResponse<SearchResult>;
		expect(secondBody.data?.items).toHaveLength(1);
		expect(secondBody.data?.items[0]).not.toEqual(firstItem);
	});

	it("returns 400 for an invalid cursor", async () => {
		const res = await app.handle(
			new Request(`${BASE}/v1/search?q=notes&cursor=invalid-cursor`),
		);

		await expectErrorResponse(res, 400, "BAD_REQUEST", "Invalid cursor");
	});

	it("updates indexed file names after rename", async () => {
		const token = `integration-file-rename-${Date.now()}`;

		const folderRes = await postFolder({ name: `${token}-folder` });
		const folder = (await folderRes.json()) as ApiResponse<Folder>;
		if (!folder.data) throw new Error("Expected folder data");
		createdIds.push(folder.data.id);

		const fileRes = await postFile(folder.data.id, {
			name: `${token}-old.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const renameRes = await patchFile(file.data.id, {
			name: `${token}-new.txt`,
		});
		expect(renameRes.status).toBe(200);

		const oldResults = await search(`${token}-old`);
		expect(
			oldResults.items.some(
				(item) => item.type === "file" && item.id === file.data?.id,
			),
		).toBe(false);

		const newResults = await search(`${token}-new`);
		expect(
			newResults.items.some(
				(item) =>
					item.type === "file" &&
					item.id === file.data?.id &&
					item.path === `/${token}-folder/${token}-new.txt`,
			),
		).toBe(true);
	});

	it("updates indexed file paths after move", async () => {
		const token = `integration-file-move-${Date.now()}`;

		const sourceRes = await postFolder({ name: `${token}-source` });
		const source = (await sourceRes.json()) as ApiResponse<Folder>;
		if (!source.data) throw new Error("Expected source folder data");
		createdIds.push(source.data.id);

		const destinationRes = await postFolder({ name: `${token}-destination` });
		const destination = (await destinationRes.json()) as ApiResponse<Folder>;
		if (!destination.data) throw new Error("Expected destination folder data");
		createdIds.push(destination.data.id);

		const fileRes = await postFile(source.data.id, {
			name: `${token}-file.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const moveRes = await patchFile(file.data.id, {
			folderId: destination.data.id,
		});
		expect(moveRes.status).toBe(200);

		const results = await search(`${token}-file`);
		expect(
			results.items.some(
				(item) =>
					item.type === "file" &&
					item.id === file.data?.id &&
					item.path === `/${token}-destination/${token}-file.txt`,
			),
		).toBe(true);
	});

	it("updates descendant indexed paths after folder rename", async () => {
		const token = `integration-folder-rename-${Date.now()}`;

		const rootRes = await postFolder({ name: `${token}-root-old` });
		const root = (await rootRes.json()) as ApiResponse<Folder>;
		if (!root.data) throw new Error("Expected root folder data");
		createdIds.push(root.data.id);

		const childRes = await postFolder({
			name: `${token}-child`,
			parentId: root.data.id,
		});
		const child = (await childRes.json()) as ApiResponse<Folder>;
		if (!child.data) throw new Error("Expected child folder data");
		createdIds.push(child.data.id);

		const fileRes = await postFile(child.data.id, {
			name: `${token}-file.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const renameRes = await patchFolder(root.data.id, {
			name: `${token}-root-new`,
		});
		expect(renameRes.status).toBe(200);

		const results = await search(`${token}-file`);
		expect(
			results.items.some(
				(item) =>
					item.type === "file" &&
					item.id === file.data?.id &&
					item.path === `/${token}-root-new/${token}-child/${token}-file.txt`,
			),
		).toBe(true);
	});

	it("removes deleted files and folders from the search index", async () => {
		const token = `integration-delete-index-${Date.now()}`;

		const folderRes = await postFolder({ name: `${token}-folder` });
		const folder = (await folderRes.json()) as ApiResponse<Folder>;
		if (!folder.data) throw new Error("Expected folder data");
		createdIds.push(folder.data.id);

		const fileRes = await postFile(folder.data.id, {
			name: `${token}-file.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const deleteFileRes = await deleteFile(file.data.id);
		expect(deleteFileRes.status).toBe(200);

		const fileResults = await search(`${token}-file`);
		expect(
			fileResults.items.some(
				(item) => item.type === "file" && item.id === file.data?.id,
			),
		).toBe(false);

		await app.handle(
			new Request(`${BASE}/v1/folders/${folder.data.id}`, { method: "DELETE" }),
		);
		createdIds.pop();

		const folderResults = await search(`${token}-folder`);
		expect(
			folderResults.items.some(
				(item) => item.type === "folder" && item.id === folder.data?.id,
			),
		).toBe(false);
	});

	it("returns 422 for an empty query", async () => {
		const res = await app.handle(new Request(`${BASE}/v1/search?q=`));

		await expectErrorResponse(
			res,
			422,
			"VALIDATION_ERROR",
			"Validation failed",
			[
				{
					path: "q",
					message: "Expected string length greater or equal to 1",
				},
			],
		);
	});

	it("returns 400 for a whitespace-only query", async () => {
		const res = await app.handle(new Request(`${BASE}/v1/search?q=%20%20%20`));

		await expectErrorResponse(res, 400, "BAD_REQUEST", "Query cannot be empty");
	});
});
