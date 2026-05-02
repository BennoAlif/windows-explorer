import { BadRequestError, NotFoundError } from "../errors";
import type { FileRepository } from "../types/file";
import type {
	CreateFolderDTO,
	Folder,
	FolderItem,
	FolderRepository,
	UpdateFolderDTO,
} from "../types/folder";

export class FolderService {
	constructor(
		private folderRepository: FolderRepository,
		private fileRepository: FileRepository,
	) {}

	async getAll(): Promise<Folder[]> {
		return await this.folderRepository.getRoot();
	}

	private async getById(id: Folder["id"]): Promise<Folder> {
		const folder = await this.folderRepository.getById(id);
		if (!folder) throw new NotFoundError("Folder", id);
		return folder;
	}

	async getItemsByFolderId(folderId: Folder["id"]): Promise<FolderItem[]> {
		await this.getById(folderId);
		const [folders, files] = await Promise.all([
			this.folderRepository.getByParentId(folderId),
			this.fileRepository.getAllByFolderId(folderId),
		]);

		return [
			...folders.map((folder) => ({
				type: "folder" as const,
				id: folder.id,
				name: folder.name,
			})),
			...files.map((file) => ({
				type: "file" as const,
				id: file.id,
				name: file.name,
			})),
		];
	}

	async create(data: CreateFolderDTO): Promise<Folder> {
		if (data.parentId !== undefined && data.parentId !== null) {
			const parent = await this.folderRepository.getById(data.parentId);
			if (!parent) throw new NotFoundError("Parent folder", data.parentId);
		}
		return await this.folderRepository.create({
			...data,
			name: data.name.trim(),
		});
	}

	async update(id: Folder["id"], data: UpdateFolderDTO): Promise<Folder> {
		await this.getById(id);
		if (data.parentId !== undefined && data.parentId !== null) {
			if (data.parentId === id)
				throw new BadRequestError("A folder cannot be its own parent");
			const parent = await this.folderRepository.getById(data.parentId);
			if (!parent) throw new NotFoundError("Parent folder", data.parentId);
		}
		return await this.folderRepository.update(id, {
			...data,
			...(data.name && { name: data.name.trim() }),
		});
	}

	async delete(id: Folder["id"]): Promise<void> {
		await this.getById(id);
		return await this.folderRepository.delete(id);
	}
}
