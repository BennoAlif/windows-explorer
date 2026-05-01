import { afterEach, describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { withErrorHandling } from "../../src/plugins/error-handler";
import { foldersRoute } from "../../src/routes/folders";
import type { ApiErrorDetail, ApiResponse } from "../../src/types/api";
import type { Folder } from "../../src/types/folder";

const app = withErrorHandling(new Elysia({ prefix: "/v1" }))
	.use(foldersRoute)
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
	it("returns 200", async () => {
		const res = await app.handle(new Request(`${BASE}/v1/folders`));
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<Folder[]>;
		expect(body.success).toBe(true);
		expect(Array.isArray(body.data)).toBe(true);
	});
});

describe("GET /v1/folders/:id/children", () => {
	it("returns child folders for an existing parent", async () => {
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

		const res = await app.handle(
			new Request(`${BASE}/v1/folders/${parent.data.id}/children`),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as ApiResponse<Folder[]>;
		expect(body.success).toBe(true);
		expect(body.data?.some((folder) => folder.id === child.data?.id)).toBe(
			true,
		);
	});

	it("returns 404 for a missing parent", async () => {
		const res = await app.handle(
			new Request(`${BASE}/v1/folders/999999/children`),
		);
		await expectErrorResponse(
			res,
			404,
			"NOT_FOUND",
			"Folder with id 999999 not found",
		);
	});

	it("returns 422 for a non-numeric parent id", async () => {
		const res = await app.handle(
			new Request(`${BASE}/v1/folders/abc/children`),
		);
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
