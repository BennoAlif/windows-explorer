import { db, folders } from 'db';
import type {
  CreateFolderDTO,
  Folder,
  FolderRepository,
  UpdateFolderDTO,
} from '../types/folder';

export class FolderRepositoryImpl implements FolderRepository {
  async getAll(): Promise<Folder[]> {
    return await db.select().from(folders);
  }
  async getById(id: Folder['id']): Promise<Folder | null> {
    throw new Error('Method not implemented.');
  }
  async create(data: CreateFolderDTO): Promise<Folder> {
    throw new Error('Method not implemented.');
  }
  async update(id: Folder['id'], data: UpdateFolderDTO): Promise<Folder> {
    throw new Error('Method not implemented.');
  }
  async delete(id: Folder['id']): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
