import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { FolderService } from '../../../src/services/folder.service';
import type { FolderRepository } from '../../../src/types/folder';
import type { Folder } from '../../../src/types/folder';

const mockFolder: Folder = {
  id: 1,
  name: 'Documents',
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo: FolderRepository = {
  getAll: mock(() => Promise.resolve([mockFolder])),
  getById: mock((id) => Promise.resolve(id === 1 ? mockFolder : null)),
  create: mock(() => Promise.resolve(mockFolder)),
  update: mock(() => Promise.resolve(mockFolder)),
  delete: mock(() => Promise.resolve()),
};

describe('FolderService', () => {
  let service: FolderService;

  beforeEach(() => {
    service = new FolderService(mockRepo);
  });

  it('getAll returns all folders', async () => {
    const result = await service.getAll();
    expect(result).toEqual([mockFolder]);
  });
});
