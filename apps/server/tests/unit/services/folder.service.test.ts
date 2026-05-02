import { beforeEach, describe, expect, it, mock } from "bun:test";
import { BadRequestError, NotFoundError } from "../../../src/errors";
import { FolderService } from "../../../src/services/folder.service";
import type { Folder, FolderRepository } from "../../../src/types/folder";

const mockFolder: Folder = {
	id: 1,
	name: "Documents",
	parentId: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

const mockChildFolder: Folder = {
	id: 2,
	name: "Child",
	parentId: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
};

const mockSecondFolder: Folder = {
	id: 3,
	name: "Downloads",
	parentId: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("FolderService", () => {
	let service: FolderService;
	let getRootPage: ReturnType<typeof mock>;
	let getById: ReturnType<typeof mock>;
	let create: ReturnType<typeof mock>;
	let update: ReturnType<typeof mock>;
	let deleteFolder: ReturnType<typeof mock>;
	let getItemsByFolderId: ReturnType<typeof mock>;

	beforeEach(() => {
		getRootPage = mock(() => Promise.resolve([mockFolder]));
		getById = mock((id: number) =>
			Promise.resolve(
				id === 1 ? mockFolder : id === 2 ? mockChildFolder : null,
			),
		);
		create = mock(() => Promise.resolve(mockFolder));
		update = mock(() => Promise.resolve(mockFolder));
		deleteFolder = mock(() => Promise.resolve());
		getItemsByFolderId = mock(() =>
			Promise.resolve([
				{ type: "folder", id: mockChildFolder.id, name: mockChildFolder.name },
				{ type: "file", id: 10, name: "notes.txt" },
			]),
		);

		const mockRepo: FolderRepository = {
			getRootPage,
			getById,
			getItemsByFolderId,
			create,
			update,
			delete: deleteFolder,
		};

		service = new FolderService(mockRepo);
	});

	describe("getAll", () => {
		it("returns root folders in a paginated result", async () => {
			const result = await service.getAll();

			expect(result).toEqual({
				items: [mockFolder],
				nextCursor: null,
			});
			expect(getRootPage.mock.calls).toEqual([
				[{ limit: 51, cursor: undefined }],
			]);
		});

		it("returns a next cursor when more root folders exist", async () => {
			getRootPage = mock(() => Promise.resolve([mockFolder, mockSecondFolder]));
			const mockRepo: FolderRepository = {
				getRootPage,
				getById,
				getItemsByFolderId,
				create,
				update,
				delete: deleteFolder,
			};
			service = new FolderService(mockRepo);

			const result = await service.getAll({ limit: 1 });

			expect(result.items).toEqual([mockFolder]);
			expect(typeof result.nextCursor).toBe("string");
			expect(getRootPage.mock.calls).toEqual([
				[{ limit: 2, cursor: undefined }],
			]);
		});

		it("decodes a valid root folder cursor before listing", async () => {
			const cursor = Buffer.from(
				JSON.stringify({ name: "Documents", id: 1 }),
				"utf8",
			).toString("base64url");

			await service.getAll({ limit: 10, cursor });

			expect(getRootPage.mock.calls).toEqual([
				[{ limit: 11, cursor: { name: "Documents", id: 1 } }],
			]);
		});

		it("throws BadRequestError for invalid root folder cursors", async () => {
			await expect(
				service.getAll({ cursor: "not-a-valid-cursor" }),
			).rejects.toBeInstanceOf(BadRequestError);
			expect(getRootPage.mock.calls).toEqual([]);
		});
	});

	describe("getItemsByFolderId", () => {
		it("returns child folders and files when folder exists", async () => {
			const result = await service.getItemsByFolderId(1);

			expect(result).toEqual({
				items: [
					{
						type: "folder",
						id: mockChildFolder.id,
						name: mockChildFolder.name,
					},
					{ type: "file", id: 10, name: "notes.txt" },
				],
				nextCursor: null,
			});
			expect(getById.mock.calls).toEqual([[1]]);
			expect(getItemsByFolderId.mock.calls).toEqual([
				[1, { limit: 51, cursor: undefined }],
			]);
		});

		it("returns a next cursor when more folder items exist", async () => {
			const result = await service.getItemsByFolderId(1, { limit: 1 });

			expect(result.items).toEqual([
				{ type: "folder", id: mockChildFolder.id, name: mockChildFolder.name },
			]);
			expect(typeof result.nextCursor).toBe("string");
			expect(getItemsByFolderId.mock.calls).toEqual([
				[1, { limit: 2, cursor: undefined }],
			]);
		});

		it("decodes a valid folder item cursor before listing", async () => {
			const cursor = Buffer.from(
				JSON.stringify({ type: "folder", name: "Child", id: 2 }),
				"utf8",
			).toString("base64url");

			await service.getItemsByFolderId(1, { limit: 10, cursor });

			expect(getItemsByFolderId.mock.calls).toEqual([
				[1, { limit: 11, cursor: { type: "folder", name: "Child", id: 2 } }],
			]);
		});

		it("throws BadRequestError for invalid folder item cursors", async () => {
			await expect(
				service.getItemsByFolderId(1, { cursor: "not-a-valid-cursor" }),
			).rejects.toBeInstanceOf(BadRequestError);
			expect(getItemsByFolderId.mock.calls).toEqual([]);
		});

		it("throws NotFoundError when folder does not exist", async () => {
			await expect(service.getItemsByFolderId(999)).rejects.toBeInstanceOf(
				NotFoundError,
			);
			expect(getById.mock.calls).toEqual([[999]]);
			expect(getItemsByFolderId.mock.calls).toEqual([]);
		});
	});

	describe("create", () => {
		it("creates a folder with a trimmed name", async () => {
			const result = await service.create({ name: "  Docs  ", parentId: null });

			expect(result).toEqual(mockFolder);
			expect(create.mock.calls).toEqual([[{ name: "Docs", parentId: null }]]);
		});

		it("does not lookup parent when parentId is null", async () => {
			await service.create({ name: "Docs", parentId: null });

			expect(getById.mock.calls).toEqual([]);
			expect(create.mock.calls).toEqual([[{ name: "Docs", parentId: null }]]);
		});

		it("does not lookup parent when parentId is omitted", async () => {
			await service.create({ name: "Docs" });

			expect(getById.mock.calls).toEqual([]);
			expect(create.mock.calls).toEqual([[{ name: "Docs" }]]);
		});

		it("creates a folder with a valid parentId", async () => {
			const result = await service.create({ name: "Child", parentId: 1 });

			expect(result).toEqual(mockFolder);
			expect(getById.mock.calls).toEqual([[1]]);
			expect(create.mock.calls).toEqual([[{ name: "Child", parentId: 1 }]]);
		});

		it("throws NotFoundError when parentId does not exist", async () => {
			await expect(
				service.create({ name: "Child", parentId: 999 }),
			).rejects.toBeInstanceOf(NotFoundError);
			expect(create.mock.calls).toEqual([]);
		});
	});

	describe("update", () => {
		it("updates an existing folder with a trimmed name", async () => {
			const result = await service.update(1, { name: "  Renamed  " });

			expect(result).toEqual(mockFolder);
			expect(getById.mock.calls).toEqual([[1]]);
			expect(update.mock.calls).toEqual([[1, { name: "Renamed" }]]);
		});

		it("updates an existing folder with a valid parentId", async () => {
			const result = await service.update(1, { parentId: 2 });

			expect(result).toEqual(mockFolder);
			expect(getById.mock.calls).toEqual([[1], [2]]);
			expect(update.mock.calls).toEqual([[1, { parentId: 2 }]]);
		});

		it("allows setting parentId to null", async () => {
			const result = await service.update(1, { parentId: null });

			expect(result).toEqual(mockFolder);
			expect(getById.mock.calls).toEqual([[1]]);
			expect(update.mock.calls).toEqual([[1, { parentId: null }]]);
		});

		it("allows an empty update body as a no-op repository update", async () => {
			const result = await service.update(1, {});

			expect(result).toEqual(mockFolder);
			expect(getById.mock.calls).toEqual([[1]]);
			expect(update.mock.calls).toEqual([[1, {}]]);
		});

		it("throws NotFoundError when folder does not exist", async () => {
			await expect(service.update(999, { name: "X" })).rejects.toBeInstanceOf(
				NotFoundError,
			);
			expect(update.mock.calls).toEqual([]);
		});

		it("throws BadRequestError when setting a folder as its own parent", async () => {
			await expect(service.update(1, { parentId: 1 })).rejects.toBeInstanceOf(
				BadRequestError,
			);
			expect(getById.mock.calls).toEqual([[1]]);
			expect(update.mock.calls).toEqual([]);
		});

		it("throws NotFoundError when parentId does not exist", async () => {
			await expect(service.update(1, { parentId: 999 })).rejects.toBeInstanceOf(
				NotFoundError,
			);
			expect(getById.mock.calls).toEqual([[1], [999]]);
			expect(update.mock.calls).toEqual([]);
		});
	});

	describe("delete", () => {
		it("validates existence before deleting", async () => {
			await expect(service.delete(1)).resolves.toBeUndefined();

			expect(getById.mock.calls).toEqual([[1]]);
			expect(deleteFolder.mock.calls).toEqual([[1]]);
		});

		it("throws NotFoundError when folder does not exist", async () => {
			await expect(service.delete(999)).rejects.toBeInstanceOf(NotFoundError);
			expect(deleteFolder.mock.calls).toEqual([]);
		});
	});
});
