import { db, folders } from 'db';
import { eq } from 'drizzle-orm';
import type {
  CreateFolderDTO,
  Folder,
  FolderRepository,
  UpdateFolderDTO,
} from '../types/folder';
import {
  ConflictError,
  InternalServerError,
  isUniqueViolation,
  NotFoundError,
} from '../errors';

export class FolderRepositoryImpl implements FolderRepository {
  async getAll(): Promise<Folder[]> {
    return await db.select().from(folders);
  }

  async getById(id: Folder['id']): Promise<Folder | null> {
    const [folder] = await db.select().from(folders).where(eq(folders.id, id));
    return folder ?? null;
  }

  async create(data: CreateFolderDTO): Promise<Folder> {
    try {
      const [folder] = await db.insert(folders).values(data).returning();
      if (!folder) throw new InternalServerError('Failed to create folder');
      return folder;
    } catch (e) {
      if (isUniqueViolation(e))
        throw new ConflictError(`Folder "${data.name}" already exists`);
      throw e;
    }
  }
  async update(id: Folder['id'], data: UpdateFolderDTO): Promise<Folder> {
    const [folder] = await db
      .update(folders)
      .set(data)
      .where(eq(folders.id, id))
      .returning();
    if (!folder) {
      throw new NotFoundError('Folder', id);
    }
    return folder;
  }
  async delete(id: Folder['id']): Promise<void> {
    const deleted = await db
      .delete(folders)
      .where(eq(folders.id, id))
      .returning();
    if (!deleted.length) {
      throw new NotFoundError('Folder', id);
    }
  }
}
