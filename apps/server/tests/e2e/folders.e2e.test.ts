import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import cors from "@elysiajs/cors";
import { Elysia } from "elysia";
import { withErrorHandling } from "../../src/plugins/error-handler";
import { foldersRoute } from "../../src/routes/folders";
import type { ApiErrorDetail, ApiResponse } from "../../src/types/api";
import type { Folder } from "../../src/types/folder";

const BASE = "http://localhost:4000";

let app: ReturnType<typeof Elysia.prototype.listen>;

beforeAll(() => {
	app = withErrorHandling(new Elysia())
		.use(cors())
		.use(withErrorHandling(new Elysia({ prefix: "/v1" })).use(foldersRoute))
		.listen(4000);
});

afterAll(() => app.stop());

const post = (body: unknown) =>
	fetch(`${BASE}/v1/folders`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

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
		await fetch(`${BASE}/v1/folders/${id}`, { method: "DELETE" });
	}
});

describe("GET /v1/folders", () => {
	it("returns 200 with array data", async () => {
		const res = await fetch(`${BASE}/v1/folders`);
		const body = (await res.json()) as ApiResponse<Folder[]>;
		expect(res.status).toBe(200);
		expect(body.success).toBe(true);
		expect(Array.isArray(body.data)).toBe(true);
	});
});

describe("GET /v1/folders/:id/children", () => {
	it("returns child folders for an existing parent", async () => {
		const parentRes = await post({ name: `e2e-parent-${Date.now()}` });
		const parent = (await parentRes.json()) as ApiResponse<Folder>;
		if (!parent.data) throw new Error("Expected parent folder data");
		createdIds.push(parent.data.id);

		const childRes = await post({
			name: `e2e-child-${Date.now()}`,
			parentId: parent.data.id,
		});
		const child = (await childRes.json()) as ApiResponse<Folder>;
		if (!child.data) throw new Error("Expected child folder data");
		createdIds.push(child.data.id);

		const res = await fetch(`${BASE}/v1/folders/${parent.data.id}/children`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<Folder[]>;
		expect(body.success).toBe(true);
		expect(body.data?.some((folder) => folder.id === child.data?.id)).toBe(
			true,
		);
	});

	it("returns 404 for a missing parent", async () => {
		const res = await fetch(`${BASE}/v1/folders/999999/children`);
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Folder with id 999999 not found",
		);
	});
});

describe("POST /v1/folders", () => {
	it("creates a folder and returns 200", async () => {
		const res = await post({ name: `e2e-${Date.now()}` });
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<Folder>;
		expect(body.success).toBe(true);
		expect(typeof body.data?.id).toBe("number");
		if (body.data) createdIds.push(body.data.id);
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
		const res = await fetch(`${BASE}/v1/folders`, { method: "POST" });
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
});

describe("PATCH /v1/folders/:id", () => {
	it("updates a folder and returns 200", async () => {
		const createRes = await post({ name: `e2e-patch-${Date.now()}` });
		const created = (await createRes.json()) as ApiResponse<Folder>;
		if (!created.data) throw new Error("Expected created folder data");
		const id = created.data.id;
		createdIds.push(id);

		const res = await fetch(`${BASE}/v1/folders/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: `e2e-patched-${Date.now()}` }),
		});
		expect(res.status).toBe(200);
	});

	it("returns 404 for a non-existing folder", async () => {
		const res = await fetch(`${BASE}/v1/folders/999999`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "X" }),
		});
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Folder with id 999999 not found",
		);
	});
});

describe("DELETE /v1/folders/:id", () => {
	it("deletes a folder and returns 200", async () => {
		const createRes = await post({ name: `e2e-delete-${Date.now()}` });
		const created = (await createRes.json()) as ApiResponse<Folder>;
		if (!created.data) throw new Error("Expected created folder data");
		const id = created.data.id;
		// don't push to createdIds — folder is being deleted in the test itself

		const res = await fetch(`${BASE}/v1/folders/${id}`, { method: "DELETE" });
		expect(res.status).toBe(200);
	});

	it("returns 404 for a non-existing folder", async () => {
		const res = await fetch(`${BASE}/v1/folders/999999`, { method: "DELETE" });
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Folder with id 999999 not found",
		);
	});
});
