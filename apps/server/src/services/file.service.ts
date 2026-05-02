import { NotFoundError } from "../errors";
import type {
	CreateFileDTO,
	FileEntity,
	FileRepository,
	UpdateFileDTO,
} from "../types/file";
import type { FolderRepository } from "../types/folder";

export class FileService {
	constructor(
		private fileRepository: FileRepository,
		private folderRepository: FolderRepository,
	) {}

	private async getById(id: FileEntity["id"]): Promise<FileEntity> {
		const file = await this.fileRepository.getById(id);
		if (!file) throw new NotFoundError("File", id);
		return file;
	}

	async create(
		folderId: FileEntity["folderId"],
		data: Omit<CreateFileDTO, "folderId">,
	): Promise<FileEntity> {
		const folder = await this.folderRepository.getById(folderId);
		if (!folder) throw new NotFoundError("Folder", folderId);

		return this.fileRepository.create({
			...data,
			folderId,
			name: data.name.trim(),
		});
	}

	async update(id: FileEntity["id"], data: UpdateFileDTO): Promise<FileEntity> {
		await this.getById(id);

		if (data.folderId !== undefined) {
			const folder = await this.folderRepository.getById(data.folderId);
			if (!folder) throw new NotFoundError("Folder", data.folderId);
		}

		return this.fileRepository.update(id, {
			...data,
			...(data.name && { name: data.name.trim() }),
		});
	}

	async delete(id: FileEntity["id"]): Promise<void> {
		await this.getById(id);
		return this.fileRepository.delete(id);
	}
}
