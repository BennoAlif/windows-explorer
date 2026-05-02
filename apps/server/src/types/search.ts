import type { FileEntity } from "./file";
import type { Folder } from "./folder";

export type SearchItem =
	| {
			type: "folder";
			id: Folder["id"];
			name: Folder["name"];
			parentId: Folder["parentId"];
			path: string;
	  }
	| {
			type: "file";
			id: FileEntity["id"];
			name: FileEntity["name"];
			folderId: FileEntity["folderId"];
			path: string;
	  };

export type SearchRow = {
	type: "folder" | "file";
	id: number;
	name: string;
	parentId: number | null;
	folderId: number | null;
	path: string;
};

export type SearchCursor = {
	type: "folder" | "file";
	name: string;
	id: number;
};

export type SearchOptions = {
	limit: number;
	cursor?: SearchCursor;
};

export type SearchResult = {
	items: SearchItem[];
	nextCursor: string | null;
};

export interface SearchRepository {
	globalSearch(query: string, options: SearchOptions): Promise<SearchItem[]>;
}
