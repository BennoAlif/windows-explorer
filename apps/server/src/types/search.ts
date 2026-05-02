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

export interface SearchRepository {
	globalSearch(query: string): Promise<SearchItem[]>;
}
