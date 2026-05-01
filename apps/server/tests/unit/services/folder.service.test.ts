import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { BadRequestError, NotFoundError } from '../../../src/errors';
import { FolderService } from '../../../src/services/folder.service';
import type { Folder, FolderRepository } from '../../../src/types/folder';

const mockFolder: Folder = {
  id: 1,
  name: 'Documents',
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo: FolderRepository = {
  getAll: mock(() => Promise.resolve([mockFolder])),
  getById: mock((id: number) => Promise.resolve(id === 1 ? mockFolder : null)),
  create: mock(() => Promise.resolve(mockFolder)),
  update: mock(() => Promise.resolve(mockFolder)),
  delete: mock(() => Promise.resolve()),
};

describe('FolderService', () => {
  let service: FolderService;

  beforeEach(() => {
    service = new FolderService(mockRepo);
  });

  describe('getAll', () => {
    it('returns all folders', async () => {
      const result = await service.getAll();
      expect(result).toEqual([mockFolder]);
    });
  });

  describe('getById', () => {
    it('returns the folder when found', async () => {
      const result = await service.getById(1);
      expect(result).toEqual(mockFolder);
    });

    it('throws NotFoundError when not found', async () => {
      await expect(service.getById(999)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('create', () => {
    it('creates a folder with a trimmed name', async () => {
      const result = await service.create({ name: '  Docs  ', parentId: null });
      expect(result).toEqual(mockFolder);
    });

    it('creates a folder with a valid parentId', async () => {
      const result = await service.create({ name: 'Child', parentId: 1 });
      expect(result).toEqual(mockFolder);
    });

    it('throws NotFoundError when parentId does not exist', async () => {
      await expect(
        service.create({ name: 'Child', parentId: 999 }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('update', () => {
    it('updates an existing folder', async () => {
      const result = await service.update(1, { name: 'Renamed' });
      expect(result).toEqual(mockFolder);
    });

    it('throws NotFoundError when folder does not exist', async () => {
      await expect(service.update(999, { name: 'X' })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('throws BadRequestError when setting a folder as its own parent', async () => {
      await expect(service.update(1, { parentId: 1 })).rejects.toBeInstanceOf(
        BadRequestError,
      );
    });

    it('throws NotFoundError when parentId does not exist', async () => {
      await expect(service.update(1, { parentId: 999 })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('delete', () => {
    it('deletes an existing folder', async () => {
      await expect(service.delete(1)).resolves.toBeUndefined();
    });

    it('throws NotFoundError when folder does not exist', async () => {
      await expect(service.delete(999)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
