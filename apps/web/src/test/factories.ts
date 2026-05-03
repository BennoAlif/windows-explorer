import type { FolderItemDTO, SearchItemDTO } from "types";
import type { FolderNode } from "@/lib/api";

export function makeFolderNode(
	overrides: Partial<FolderNode> = {},
): FolderNode {
	return {
		id: 1,
		name: "Folder",
		parentId: null,
		children: [],
		items: [],
		isOpen: false,
		isLoading: false,
		itemsLoaded: false,
		childrenLoaded: false,
		nextCursor: null,
		...overrides,
	};
}

export function makeFolderItem(
	overrides: Partial<Extract<FolderItemDTO, { type: "folder" }>> = {},
): FolderItemDTO {
	return {
		type: "folder",
		id: 1,
		name: "Folder item",
		...overrides,
	};
}

export function makeFileItem(
	overrides: Partial<Extract<FolderItemDTO, { type: "file" }>> = {},
): FolderItemDTO {
	return {
		type: "file",
		id: 2,
		name: "File item",
		...overrides,
	};
}

export function makeSearchFolder(
	overrides: Partial<Extract<SearchItemDTO, { type: "folder" }>> = {},
): SearchItemDTO {
	return {
		type: "folder",
		id: 1,
		name: "Folder result",
		parentId: null,
		path: "/Folder result",
		...overrides,
	};
}

export function makeSearchFile(
	overrides: Partial<Extract<SearchItemDTO, { type: "file" }>> = {},
): SearchItemDTO {
	return {
		type: "file",
		id: 2,
		name: "File result",
		folderId: 1,
		path: "/Folder result/File result",
		...overrides,
	};
}
