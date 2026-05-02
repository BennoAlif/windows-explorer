import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NotFoundError } from "../../../src/errors";
import { FileService } from "../../../src/services/file.service";
import type { FileEntity, FileRepository } from "../../../src/types/file";
import type { Folder, FolderRepository } from "../../../src/types/folder";

const mockFolder: Folder = {
	id: 1,
	name: "Documents",
	parentId: null,
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

describe("FileService", () => {
	let service: FileService;
	let fileGetById: ReturnType<typeof mock>;
	let fileCreate: ReturnType<typeof mock>;
	let fileUpdate: ReturnType<typeof mock>;
	let fileDelete: ReturnType<typeof mock>;
	let folderGetById: ReturnType<typeof mock>;

	beforeEach(() => {
		fileGetById = mock((id: number) =>
			Promise.resolve(id === mockFile.id ? mockFile : null),
		);
		fileCreate = mock(() => Promise.resolve(mockFile));
		fileUpdate = mock(() => Promise.resolve(mockFile));
		fileDelete = mock(() => Promise.resolve());
		folderGetById = mock((id: number) =>
			Promise.resolve(id === mockFolder.id ? mockFolder : null),
		);

		const fileRepository: FileRepository = {
			getAllByFolderId: mock(),
			getById: fileGetById,
			create: fileCreate,
			update: fileUpdate,
			delete: fileDelete,
		};

		const folderRepository: FolderRepository = {
			getRootPage: mock(),
			getById: folderGetById,
			getItemsByFolderId: mock(),
			create: mock(),
			update: mock(),
			delete: mock(),
		};

		service = new FileService(fileRepository, folderRepository);
	});

	describe("create", () => {
		it("creates a file in an existing folder with a trimmed name", async () => {
			const result = await service.create(1, { name: "  notes.txt  " });

			expect(result).toEqual(mockFile);
			expect(folderGetById.mock.calls).toEqual([[1]]);
			expect(fileCreate.mock.calls).toEqual([
				[{ name: "notes.txt", folderId: 1 }],
			]);
		});

		it("throws NotFoundError when folder does not exist", async () => {
			await expect(
				service.create(999, { name: "notes.txt" }),
			).rejects.toBeInstanceOf(NotFoundError);
			expect(fileCreate.mock.calls).toEqual([]);
		});
	});

	describe("update", () => {
		it("updates an existing file with a trimmed name", async () => {
			const result = await service.update(10, { name: "  renamed.txt  " });

			expect(result).toEqual(mockFile);
			expect(fileGetById.mock.calls).toEqual([[10]]);
			expect(folderGetById.mock.calls).toEqual([]);
			expect(fileUpdate.mock.calls).toEqual([[10, { name: "renamed.txt" }]]);
		});

		it("moves an existing file to an existing folder", async () => {
			const result = await service.update(10, { folderId: 1 });

			expect(result).toEqual(mockFile);
			expect(fileGetById.mock.calls).toEqual([[10]]);
			expect(folderGetById.mock.calls).toEqual([[1]]);
			expect(fileUpdate.mock.calls).toEqual([[10, { folderId: 1 }]]);
		});

		it("throws NotFoundError when moving to a missing folder", async () => {
			await expect(
				service.update(10, { folderId: 999 }),
			).rejects.toBeInstanceOf(NotFoundError);
			expect(fileGetById.mock.calls).toEqual([[10]]);
			expect(folderGetById.mock.calls).toEqual([[999]]);
			expect(fileUpdate.mock.calls).toEqual([]);
		});

		it("throws NotFoundError when file does not exist", async () => {
			await expect(
				service.update(999, { name: "x.txt" }),
			).rejects.toBeInstanceOf(NotFoundError);
			expect(fileUpdate.mock.calls).toEqual([]);
		});
	});

	describe("delete", () => {
		it("validates existence before deleting", async () => {
			await expect(service.delete(10)).resolves.toBeUndefined();

			expect(fileGetById.mock.calls).toEqual([[10]]);
			expect(fileDelete.mock.calls).toEqual([[10]]);
		});

		it("throws NotFoundError when file does not exist", async () => {
			await expect(service.delete(999)).rejects.toBeInstanceOf(NotFoundError);
			expect(fileDelete.mock.calls).toEqual([]);
		});
	});
});
