import type { Folder, FolderRepository } from '../types/folder';

export class FolderService {
  constructor(private folderRepository: FolderRepository) {}
  getAll(): Promise<Folder[]> {
    return this.folderRepository.getAll();
  }
}
