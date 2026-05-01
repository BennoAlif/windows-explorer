import type { folders } from 'db';

export type Folder = typeof folders.$inferSelect;

export type CreateFolderDTO = Omit<
  typeof folders.$inferInsert,
  'id' | 'createdAt' | 'updatedAt'
>;

export type UpdateFolderDTO = Partial<CreateFolderDTO>;

export interface FolderRepository {
  getRoot(): Promise<Folder[]>;
  getById(id: Folder['id']): Promise<Folder | null>;
  getByParentId(parentId: Folder['id']): Promise<Folder[]>;
  create(data: CreateFolderDTO): Promise<Folder>;
  update(id: Folder['id'], data: UpdateFolderDTO): Promise<Folder>;
  delete(id: Folder['id']): Promise<void>;
}
