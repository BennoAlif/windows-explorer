import type { files } from 'db';

export type FileEntity = typeof files.$inferSelect;
export type CreateFileDTO = Omit<
  typeof files.$inferInsert,
  'id' | 'createdAt' | 'updatedAt'
>;
export type UpdateFileDTO = Partial<CreateFileDTO>;

export interface FileRepository {
  getAll(): Promise<FileEntity[]>;
  getById(id: FileEntity['id']): Promise<FileEntity | null>;
  create(data: CreateFileDTO): Promise<FileEntity>;
  update(id: FileEntity['id'], data: UpdateFileDTO): Promise<FileEntity>;
  delete(id: FileEntity['id']): Promise<void>;
}
