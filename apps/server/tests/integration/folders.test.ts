import { afterEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { withErrorHandling } from "../../src/plugins/error-handler";
import { filesRoute } from "../../src/routes/files";
import { foldersRoute } from "../../src/routes/folders";
import type { ApiErrorDetail, ApiResponse } from "../../src/types/api";
import type { FileEntity } from "../../src/types/file";
import type {
	Folder,
	FolderItemResult,
	FolderListResult,
} from "../../src/types/folder";

const app = withErrorHandling(new Elysia({ prefix: "/v1" }))
	.use(foldersRoute)
	.use(filesRoute)
	.get("/test-error", () => {
		throw new Error("Unexpected failure");
	});

const BASE = "http://localhost";

const post = (body: unknown) =>
	app.handle(
		new Request(`${BASE}/v1/folders`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

const patch = (id: Folder["id"], body: unknown) =>
	app.handle(
		new Request(`${BASE}/v1/folders/${id}`, {
			method: "PATCH",
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

const patchFile = (id: FileEntity["id"], body: unknown) =>
	app.handle(
		new Request(`${BASE}/v1/files/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

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

describe("GET /v1/folders", () => {
	it("returns 200 with a paginated result", async () => {
		const res = await app.handle(new Request(`${BASE}/v1/folders`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<FolderListResult>;
		expect(body.success).toBe(true);
		expect(Array.isArray(body.data?.items)).toBe(true);
		expect(
			body.data?.nextCursor === null ||
				typeof body.data?.nextCursor === "string",
		).toBe(true);
	});

	it("paginates root folders with a cursor", async () => {
		const token = `000-integration-root-cursor-${Date.now()}`;
		const firstRes = await post({ name: `${token}-a` });
		const first = (await firstRes.json()) as ApiResponse<Folder>;
		if (!first.data) throw new Error("Expected first folder data");
		createdIds.push(first.data.id);

		const secondRes = await post({ name: `${token}-b` });
		const second = (await secondRes.json()) as ApiResponse<Folder>;
		if (!second.data) throw new Error("Expected second folder data");
		createdIds.push(second.data.id);

		const pageOneRes = await app.handle(
			new Request(`${BASE}/v1/folders?limit=1`),
		);
		expect(pageOneRes.status).toBe(200);
		const pageOne = (await pageOneRes.json()) as ApiResponse<FolderListResult>;
		expect(pageOne.data?.items).toHaveLength(1);
		expect(typeof pageOne.data?.nextCursor).toBe("string");

		const firstItem = pageOne.data?.items[0];
		const cursor = pageOne.data?.nextCursor;
		if (!firstItem || !cursor) throw new Error("Expected root page cursor");

		const pageTwoRes = await app.handle(
			new Request(
				`${BASE}/v1/folders?limit=1&cursor=${encodeURIComponent(cursor)}`,
			),
		);
		expect(pageTwoRes.status).toBe(200);
		const pageTwo = (await pageTwoRes.json()) as ApiResponse<FolderListResult>;
		expect(pageTwo.data?.items).toHaveLength(1);
		expect(pageTwo.data?.items[0]).not.toEqual(firstItem);
	});

	it("returns 400 for an invalid root folder cursor", async () => {
		const res = await app.handle(
			new Request(`${BASE}/v1/folders?cursor=invalid-cursor`),
		);

		await expectErrorResponse(res, 400, "BAD_REQUEST", "Invalid cursor");
	});
});

describe("GET /v1/folders/:id/items", () => {
	it("returns child folders and files for an existing folder", async () => {
		const parentRes = await post({ name: `integration-parent-${Date.now()}` });
		const parent = (await parentRes.json()) as ApiResponse<Folder>;
		if (!parent.data) throw new Error("Expected parent folder data");
		createdIds.push(parent.data.id);

		const childRes = await post({
			name: `integration-child-${Date.now()}`,
			parentId: parent.data.id,
		});
		const child = (await childRes.json()) as ApiResponse<Folder>;
		if (!child.data) throw new Error("Expected child folder data");
		createdIds.push(child.data.id);

		const fileRes = await postFile(parent.data.id, {
			name: `integration-file-${Date.now()}.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const res = await app.handle(
			new Request(`${BASE}/v1/folders/${parent.data.id}/items`),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<FolderItemResult>;
		expect(body.success).toBe(true);
		expect(
			body.data?.items.some(
				(item) => item.type === "folder" && item.id === child.data?.id,
			),
		).toBe(true);
		expect(
			body.data?.items.some(
				(item) => item.type === "file" && item.id === file.data?.id,
			),
		).toBe(true);
		expect(body.data?.nextCursor).toBeNull();
	});

	it("paginates folder items with a cursor", async () => {
		const parentRes = await post({
			name: `integration-items-parent-${Date.now()}`,
		});
		const parent = (await parentRes.json()) as ApiResponse<Folder>;
		if (!parent.data) throw new Error("Expected parent folder data");
		createdIds.push(parent.data.id);

		const childRes = await post({
			name: `integration-items-child-${Date.now()}`,
			parentId: parent.data.id,
		});
		const child = (await childRes.json()) as ApiResponse<Folder>;
		if (!child.data) throw new Error("Expected child folder data");
		createdIds.push(child.data.id);

		await postFile(parent.data.id, {
			name: `integration-items-file-${Date.now()}.txt`,
		});

		const pageOneRes = await app.handle(
			new Request(`${BASE}/v1/folders/${parent.data.id}/items?limit=1`),
		);
		expect(pageOneRes.status).toBe(200);
		const pageOne = (await pageOneRes.json()) as ApiResponse<FolderItemResult>;
		expect(pageOne.data?.items).toHaveLength(1);
		expect(typeof pageOne.data?.nextCursor).toBe("string");

		const firstItem = pageOne.data?.items[0];
		const cursor = pageOne.data?.nextCursor;
		if (!firstItem || !cursor) throw new Error("Expected folder item cursor");

		const pageTwoRes = await app.handle(
			new Request(
				`${BASE}/v1/folders/${parent.data.id}/items?limit=1&cursor=${encodeURIComponent(cursor)}`,
			),
		);
		expect(pageTwoRes.status).toBe(200);
		const pageTwo = (await pageTwoRes.json()) as ApiResponse<FolderItemResult>;
		expect(pageTwo.data?.items).toHaveLength(1);
		expect(pageTwo.data?.items[0]).not.toEqual(firstItem);
	});

	it("returns 400 for an invalid folder item cursor", async () => {
		const parentRes = await post({
			name: `integration-items-invalid-${Date.now()}`,
		});
		const parent = (await parentRes.json()) as ApiResponse<Folder>;
		if (!parent.data) throw new Error("Expected parent folder data");
		createdIds.push(parent.data.id);

		const res = await app.handle(
			new Request(
				`${BASE}/v1/folders/${parent.data.id}/items?cursor=invalid-cursor`,
			),
		);

		await expectErrorResponse(res, 400, "BAD_REQUEST", "Invalid cursor");
	});

	it("returns 404 for a missing folder", async () => {
		const res = await app.handle(
			new Request(`${BASE}/v1/folders/999999/items`),
		);
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Folder with id 999999 not found",
		);
	});

	it("returns 422 for a non-numeric parent id", async () => {
		const res = await app.handle(new Request(`${BASE}/v1/folders/abc/items`));
		await expectErrorResponse(
			res,
			422,
			"VALIDATION_ERROR",
			"Validation failed",
			[
				{
					path: "id",
					message: "Property 'id' should be one of: 'numeric', 'number'",
				},
			],
		);
	});
});

describe("POST /v1/folders", () => {
	it("creates a folder and returns 200", async () => {
		const res = await post({ name: `integration-${Date.now()}` });
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<Folder>;
		expect(body.success).toBe(true);
		expect(typeof body.data?.id).toBe("number");
		if (body.data) createdIds.push(body.data.id);
	});

	it("creates a folder with a valid parentId", async () => {
		const parentRes = await post({ name: `integration-parent-${Date.now()}` });
		const parent = (await parentRes.json()) as ApiResponse<Folder>;
		if (!parent.data) throw new Error("Expected parent folder data");
		createdIds.push(parent.data.id);

		const res = await post({
			name: `integration-child-${Date.now()}`,
			parentId: parent.data.id,
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<Folder>;
		expect(body.success).toBe(true);
		expect(body.data?.parentId).toBe(parent.data.id);
		if (body.data) createdIds.push(body.data.id);
	});

	it("returns 404 when parentId does not exist", async () => {
		const res = await post({
			name: `integration-missing-parent-${Date.now()}`,
			parentId: 999999,
		});
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Parent folder with id 999999 not found",
		);
	});

	it("returns 422 for empty name", async () => {
		const res = await post({ name: "" });
		await expectErrorResponse(
			res,
			422,
			"VALIDATION_ERROR",
			"Validation failed",
			[
				{
					path: "name",
					message: "Expected string length greater or equal to 1",
				},
			],
		);
	});

	it("returns 422 for missing body", async () => {
		const res = await app.handle(
			new Request(`${BASE}/v1/folders`, { method: "POST" }),
		);
		await expectErrorResponse(
			res,
			422,
			"VALIDATION_ERROR",
			"Validation failed",
			[
				{
					path: "",
					message: "Expected object",
				},
			],
		);
	});

	it("returns 409 for a duplicate folder name", async () => {
		const name = `integration-conflict-${Date.now()}`;
		const createRes = await post({ name });
		const created = (await createRes.json()) as ApiResponse<Folder>;
		if (!created.data) throw new Error("Expected created folder data");
		createdIds.push(created.data.id);

		const res = await post({ name });
		await expectErrorResponse(
			res,
			409,
			"CONFLICT",
			`Folder "${name}" already exists`,
		);
	});
});

describe("POST /v1/folders/:folderId/files", () => {
	it("creates a file inside an existing folder", async () => {
		const folderRes = await post({
			name: `integration-file-parent-${Date.now()}`,
		});
		const folder = (await folderRes.json()) as ApiResponse<Folder>;
		if (!folder.data) throw new Error("Expected folder data");
		createdIds.push(folder.data.id);

		const res = await postFile(folder.data.id, {
			name: `integration-file-${Date.now()}.txt`,
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<FileEntity>;
		expect(body.success).toBe(true);
		expect(body.data?.folderId).toBe(folder.data.id);
		expect(typeof body.data?.id).toBe("number");
	});

	it("returns 404 when folder does not exist", async () => {
		const res = await postFile(999999, {
			name: `integration-missing-file-${Date.now()}.txt`,
		});
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Folder with id 999999 not found",
		);
	});

	it("returns 409 for a duplicate file name in the same folder", async () => {
		const folderRes = await post({
			name: `integration-file-conflict-parent-${Date.now()}`,
		});
		const folder = (await folderRes.json()) as ApiResponse<Folder>;
		if (!folder.data) throw new Error("Expected folder data");
		createdIds.push(folder.data.id);

		const name = `integration-conflict-${Date.now()}.txt`;
		await postFile(folder.data.id, { name });

		const res = await postFile(folder.data.id, { name });
		await expectErrorResponse(
			res,
			409,
			"CONFLICT",
			`File "${name}" already exists`,
		);
	});
});

describe("PATCH /v1/folders/:id", () => {
	it("updates a folder and returns 200", async () => {
		const createRes = await post({ name: `integration-patch-${Date.now()}` });
		const created = (await createRes.json()) as ApiResponse<Folder>;
		if (!created.data) throw new Error("Expected created folder data");
		const id = created.data.id;
		createdIds.push(id);

		const res = await patch(id, { name: `integration-patched-${Date.now()}` });
		expect(res.status).toBe(200);
	});

	it("updates a folder with a valid parentId", async () => {
		const parentRes = await post({ name: `integration-parent-${Date.now()}` });
		const parent = (await parentRes.json()) as ApiResponse<Folder>;
		if (!parent.data) throw new Error("Expected parent folder data");
		createdIds.push(parent.data.id);

		const childRes = await post({ name: `integration-child-${Date.now()}` });
		const child = (await childRes.json()) as ApiResponse<Folder>;
		if (!child.data) throw new Error("Expected child folder data");
		createdIds.push(child.data.id);

		const res = await patch(child.data.id, { parentId: parent.data.id });
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<Folder>;
		expect(body.success).toBe(true);
		expect(body.data?.parentId).toBe(parent.data.id);
	});

	it("returns 404 when parentId does not exist", async () => {
		const createRes = await post({
			name: `integration-missing-update-parent-${Date.now()}`,
		});
		const created = (await createRes.json()) as ApiResponse<Folder>;
		if (!created.data) throw new Error("Expected created folder data");
		createdIds.push(created.data.id);

		const res = await patch(created.data.id, { parentId: 999999 });
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Parent folder with id 999999 not found",
		);
	});

	it("moves a folder to root with parentId null", async () => {
		const parentRes = await post({ name: `integration-parent-${Date.now()}` });
		const parent = (await parentRes.json()) as ApiResponse<Folder>;
		if (!parent.data) throw new Error("Expected parent folder data");
		createdIds.push(parent.data.id);

		const childRes = await post({
			name: `integration-child-${Date.now()}`,
			parentId: parent.data.id,
		});
		const child = (await childRes.json()) as ApiResponse<Folder>;
		if (!child.data) throw new Error("Expected child folder data");
		createdIds.push(child.data.id);

		const res = await patch(child.data.id, { parentId: null });
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<Folder>;
		expect(body.success).toBe(true);
		expect(body.data?.parentId).toBeNull();
	});

	it("returns 409 when updating to a duplicate folder name", async () => {
		const firstName = `integration-first-${Date.now()}`;
		const secondName = `integration-second-${Date.now()}`;

		const firstRes = await post({ name: firstName });
		const first = (await firstRes.json()) as ApiResponse<Folder>;
		if (!first.data) throw new Error("Expected first folder data");
		createdIds.push(first.data.id);

		const secondRes = await post({ name: secondName });
		const second = (await secondRes.json()) as ApiResponse<Folder>;
		if (!second.data) throw new Error("Expected second folder data");
		createdIds.push(second.data.id);

		const res = await patch(second.data.id, { name: firstName });
		await expectErrorResponse(
			res,
			409,
			"CONFLICT",
			`Folder "${firstName}" already exists`,
		);
	});

	it("returns 404 for a non-existing folder", async () => {
		const res = await patch(999999, { name: "X" });
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Folder with id 999999 not found",
		);
	});

	it("returns 400 when setting a folder as its own parent", async () => {
		const createRes = await post({ name: `integration-bad-${Date.now()}` });
		const created = (await createRes.json()) as ApiResponse<Folder>;
		if (!created.data) throw new Error("Expected created folder data");
		const id = created.data.id;
		createdIds.push(id);

		const res = await patch(id, { parentId: id });
		await expectErrorResponse(
			res,
			400,
			"BAD_REQUEST",
			"A folder cannot be its own parent",
		);
	});
});

describe("PATCH /v1/files/:id", () => {
	it("renames a file and returns 200", async () => {
		const folderRes = await post({
			name: `integration-file-patch-parent-${Date.now()}`,
		});
		const folder = (await folderRes.json()) as ApiResponse<Folder>;
		if (!folder.data) throw new Error("Expected folder data");
		createdIds.push(folder.data.id);

		const fileRes = await postFile(folder.data.id, {
			name: `integration-patch-${Date.now()}.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const res = await patchFile(file.data.id, {
			name: `integration-patched-${Date.now()}.txt`,
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<FileEntity>;
		expect(body.success).toBe(true);
		expect(body.data?.id).toBe(file.data.id);
	});

	it("moves a file to an existing folder", async () => {
		const firstFolderRes = await post({
			name: `integration-file-move-from-${Date.now()}`,
		});
		const firstFolder = (await firstFolderRes.json()) as ApiResponse<Folder>;
		if (!firstFolder.data) throw new Error("Expected first folder data");
		createdIds.push(firstFolder.data.id);

		const secondFolderRes = await post({
			name: `integration-file-move-to-${Date.now()}`,
		});
		const secondFolder = (await secondFolderRes.json()) as ApiResponse<Folder>;
		if (!secondFolder.data) throw new Error("Expected second folder data");
		createdIds.push(secondFolder.data.id);

		const fileRes = await postFile(firstFolder.data.id, {
			name: `integration-move-${Date.now()}.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const res = await patchFile(file.data.id, {
			folderId: secondFolder.data.id,
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<FileEntity>;
		expect(body.success).toBe(true);
		expect(body.data?.folderId).toBe(secondFolder.data.id);
	});

	it("returns 404 when moving to a missing folder", async () => {
		const folderRes = await post({
			name: `integration-file-missing-move-parent-${Date.now()}`,
		});
		const folder = (await folderRes.json()) as ApiResponse<Folder>;
		if (!folder.data) throw new Error("Expected folder data");
		createdIds.push(folder.data.id);

		const fileRes = await postFile(folder.data.id, {
			name: `integration-missing-move-${Date.now()}.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const res = await patchFile(file.data.id, { folderId: 999999 });
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Folder with id 999999 not found",
		);
	});

	it("returns 404 for a non-existing file", async () => {
		const res = await patchFile(999999, { name: "x.txt" });
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"File with id 999999 not found",
		);
	});
});

describe("DELETE /v1/files/:id", () => {
	it("deletes a file and returns 200", async () => {
		const folderRes = await post({
			name: `integration-file-delete-parent-${Date.now()}`,
		});
		const folder = (await folderRes.json()) as ApiResponse<Folder>;
		if (!folder.data) throw new Error("Expected folder data");
		createdIds.push(folder.data.id);

		const fileRes = await postFile(folder.data.id, {
			name: `integration-delete-${Date.now()}.txt`,
		});
		const file = (await fileRes.json()) as ApiResponse<FileEntity>;
		if (!file.data) throw new Error("Expected file data");

		const res = await app.handle(
			new Request(`${BASE}/v1/files/${file.data.id}`, { method: "DELETE" }),
		);
		expect(res.status).toBe(200);
	});

	it("returns 404 for a non-existing file", async () => {
		const res = await app.handle(
			new Request(`${BASE}/v1/files/999999`, { method: "DELETE" }),
		);
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"File with id 999999 not found",
		);
	});
});

describe("DELETE /v1/folders/:id", () => {
	it("deletes a folder and returns 200", async () => {
		const createRes = await post({ name: `integration-delete-${Date.now()}` });
		const created = (await createRes.json()) as ApiResponse<Folder>;
		if (!created.data) throw new Error("Expected created folder data");
		const id = created.data.id;
		// don't push to createdIds — already being deleted

		const res = await app.handle(
			new Request(`${BASE}/v1/folders/${id}`, { method: "DELETE" }),
		);
		expect(res.status).toBe(200);
	});

	it("returns 404 for a non-existing folder", async () => {
		const res = await app.handle(
			new Request(`${BASE}/v1/folders/999999`, { method: "DELETE" }),
		);
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Folder with id 999999 not found",
		);
	});
});

describe("shared error handler", () => {
	it("returns 500 for unexpected errors", async () => {
		const res = await app.handle(new Request(`${BASE}/v1/test-error`));
		await expectErrorResponse(
			res,
			500,
			"INTERNAL_SERVER_ERROR",
			"Internal server error",
		);
	});
});
