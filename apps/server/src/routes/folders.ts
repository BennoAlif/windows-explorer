import { Elysia, t } from 'elysia';
import { FolderRepositoryImpl } from '../repositories/folder.repository';
import { FolderService } from '../services/folder.service';

const service = new FolderService(new FolderRepositoryImpl());

export const foldersRoute = new Elysia({ prefix: '/folders' }).get('/', () =>
  service.getAll(),
);
