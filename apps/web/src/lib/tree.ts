import type { FolderNode } from "./api";

export type VisibleFolderRow = {
	folder: FolderNode;
	depth: number;
};
export function flattenVisibleFolders(
	folders: FolderNode[],
	depth = 0,
): VisibleFolderRow[] {
	const rows: VisibleFolderRow[] = [];

	for (const folder of folders) {
		rows.push({ folder, depth });

		if (folder.isOpen) {
			rows.push(...flattenVisibleFolders(folder.children, depth + 1));
		}
	}

	return rows;
}
