import type { folders } from "db";
import type { FileEntity } from "./file";

export type Folder = typeof folders.$inferSelect;

export type CreateFolderDTO = Omit<
	typeof folders.$inferInsert,
	"id" | "createdAt" | "updatedAt"
>;

export type UpdateFolderDTO = Partial<CreateFolderDTO>;

export interface FolderRepository {
	getRootPage(options: FolderPageOptions): Promise<Folder[]>;
	getById(id: Folder["id"]): Promise<Folder | null>;
	getItemsByFolderId(
		folderId: Folder["id"],
		options: FolderItemPageOptions,
	): Promise<FolderItem[]>;
	create(data: CreateFolderDTO): Promise<Folder>;
	update(id: Folder["id"], data: UpdateFolderDTO): Promise<Folder>;
	delete(id: Folder["id"]): Promise<void>;
}

export type FolderItem =
	| {
			type: "folder";
			id: Folder["id"];
			name: Folder["name"];
	  }
	| {
			type: "file";
			id: FileEntity["id"];
			name: FileEntity["name"];
	  };

export type FolderCursor = {
	name: string;
	id: number;
};

export type FolderItemCursor = {
	type: "folder" | "file";
	name: string;
	id: number;
};

export type FolderPageOptions = {
	limit: number;
	cursor?: FolderCursor;
};

export type FolderItemPageOptions = {
	limit: number;
	cursor?: FolderItemCursor;
};

export type FolderListResult = {
	items: Folder[];
	nextCursor: string | null;
};

export type FolderItemResult = {
	items: FolderItem[];
	nextCursor: string | null;
};
