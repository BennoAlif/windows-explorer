import { BadRequestError, NotFoundError } from '../errors';
import type {
  CreateFolderDTO,
  Folder,
  FolderRepository,
  UpdateFolderDTO,
} from '../types/folder';

export class FolderService {
  constructor(private folderRepository: FolderRepository) {}

  async getAll(): Promise<Folder[]> {
    return await this.folderRepository.getRoot();
  }

  private async getById(id: Folder['id']): Promise<Folder> {
    const folder = await this.folderRepository.getById(id);
    if (!folder) throw new NotFoundError('Folder', id);
    return folder;
  }

  async getByParentId(parentId: Folder['id']): Promise<Folder[]> {
    await this.getById(parentId);
    return await this.folderRepository.getByParentId(parentId);
  }

  async create(data: CreateFolderDTO): Promise<Folder> {
    if (data.parentId !== undefined && data.parentId !== null) {
      const parent = await this.folderRepository.getById(data.parentId);
      if (!parent) throw new NotFoundError('Parent folder', data.parentId);
    }
    return await this.folderRepository.create({
      ...data,
      name: data.name.trim(),
    });
  }

  async update(id: Folder['id'], data: UpdateFolderDTO): Promise<Folder> {
    await this.getById(id);
    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === id)
        throw new BadRequestError('A folder cannot be its own parent');
      const parent = await this.folderRepository.getById(data.parentId);
      if (!parent) throw new NotFoundError('Parent folder', data.parentId);
    }
    return await this.folderRepository.update(id, {
      ...data,
      ...(data.name && { name: data.name.trim() }),
    });
  }

  async delete(id: Folder['id']): Promise<void> {
    await this.getById(id);
    return await this.folderRepository.delete(id);
  }
}
