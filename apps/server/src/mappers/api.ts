import type {
	FileDTO,
	FolderDTO,
	FolderItemResultDTO,
	FolderListResultDTO,
	SearchResultDTO,
} from "types";
import type { FileEntity } from "../types/file";
import type {
	Folder,
	FolderItemResult,
	FolderListResult,
} from "../types/folder";
import type { SearchResult } from "../types/search";

const toIsoString = (value: Date | string): string =>
	value instanceof Date ? value.toISOString() : value;

export const toFolderDTO = (folder: Folder): FolderDTO => ({
	id: folder.id,
	name: folder.name,
	parentId: folder.parentId,
	createdAt: toIsoString(folder.createdAt),
	updatedAt: toIsoString(folder.updatedAt),
});

export const toFileDTO = (file: FileEntity): FileDTO => ({
	id: file.id,
	name: file.name,
	folderId: file.folderId,
	createdAt: toIsoString(file.createdAt),
	updatedAt: toIsoString(file.updatedAt),
});

export const toFolderListResultDTO = (
	result: FolderListResult,
): FolderListResultDTO => ({
	items: result.items.map(toFolderDTO),
	nextCursor: result.nextCursor,
});

export const toFolderItemResultDTO = (
	result: FolderItemResult,
): FolderItemResultDTO => ({
	items: result.items,
	nextCursor: result.nextCursor,
});

export const toSearchResultDTO = (result: SearchResult): SearchResultDTO => ({
	items: result.items,
	nextCursor: result.nextCursor,
});
