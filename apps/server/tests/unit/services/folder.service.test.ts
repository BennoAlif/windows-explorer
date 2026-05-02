import { beforeEach, describe, expect, it, mock } from "bun:test";
import { BadRequestError, NotFoundError } from "../../../src/errors";
import { FolderService } from "../../../src/services/folder.service";
import type { FileEntity, FileRepository } from "../../../src/types/file";
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

const mockFile: FileEntity = {
	id: 10,
	name: "notes.txt",
	folderId: 1,
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("FolderService", () => {
	let service: FolderService;
	let getRoot: ReturnType<typeof mock>;
	let getByParentId: ReturnType<typeof mock>;
	let getById: ReturnType<typeof mock>;
	let create: ReturnType<typeof mock>;
	let update: ReturnType<typeof mock>;
	let deleteFolder: ReturnType<typeof mock>;
	let getAllByFolderId: ReturnType<typeof mock>;

	beforeEach(() => {
		getRoot = mock(() => Promise.resolve([mockFolder]));
		getByParentId = mock(() => Promise.resolve([mockChildFolder]));
		getById = mock((id: number) =>
			Promise.resolve(
				id === 1 ? mockFolder : id === 2 ? mockChildFolder : null,
			),
		);
		create = mock(() => Promise.resolve(mockFolder));
		update = mock(() => Promise.resolve(mockFolder));
		deleteFolder = mock(() => Promise.resolve());
		getAllByFolderId = mock(() => Promise.resolve([mockFile]));

		const mockRepo: FolderRepository = {
			getRoot,
			getByParentId,
			getById,
			create,
			update,
			delete: deleteFolder,
		};

		const mockFileRepo: FileRepository = {
			getAllByFolderId,
			getById: mock(),
			create: mock(),
			update: mock(),
			delete: mock(),
		};

		service = new FolderService(mockRepo, mockFileRepo);
	});

	describe("getAll", () => {
		it("returns all root folders", async () => {
			const result = await service.getAll();

			expect(result).toEqual([mockFolder]);
			expect(getRoot.mock.calls).toEqual([[]]);
		});
	});

	describe("getItemsByFolderId", () => {
		it("returns child folders and files when folder exists", async () => {
			const result = await service.getItemsByFolderId(1);

			expect(result).toEqual([
				{ type: "folder", id: mockChildFolder.id, name: mockChildFolder.name },
				{ type: "file", id: mockFile.id, name: mockFile.name },
			]);
			expect(getById.mock.calls).toEqual([[1]]);
			expect(getByParentId.mock.calls).toEqual([[1]]);
			expect(getAllByFolderId.mock.calls).toEqual([[1]]);
		});

		it("throws NotFoundError when folder does not exist", async () => {
			await expect(service.getItemsByFolderId(999)).rejects.toBeInstanceOf(
				NotFoundError,
			);
			expect(getById.mock.calls).toEqual([[999]]);
			expect(getByParentId.mock.calls).toEqual([]);
			expect(getAllByFolderId.mock.calls).toEqual([]);
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
