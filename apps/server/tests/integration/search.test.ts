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
