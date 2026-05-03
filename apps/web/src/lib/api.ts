import type {
	ApiError,
	ApiResponse,
	FolderDTO,
	FolderItemDTO,
	FolderItemResultDTO,
	FolderListResultDTO,
	PageResult,
} from "types";

const API_BASE_URL = (
	import.meta.env.VITE_API_URL ?? "http://localhost:3000/v1"
).replace(/\/$/, "");

export type FolderNode = Pick<FolderDTO, "id" | "name" | "parentId"> & {
	children: FolderNode[];
	items: FolderItemDTO[];
	isOpen: boolean;
	isLoading: boolean;
	itemsLoaded: boolean;
};

export class ApiClientError extends Error {
	readonly error?: ApiError;

	constructor(message: string, error?: ApiError) {
		super(message);
		this.name = "ApiClientError";
		this.error = error;
	}
}

const request = async <T>(
	path: string,
	params?: Record<string, string | number | null | undefined>,
): Promise<T> => {
	const url = new URL(`${API_BASE_URL}${path}`);

	for (const [key, value] of Object.entries(params ?? {})) {
		if (value !== undefined && value !== null) {
			url.searchParams.set(key, String(value));
		}
	}

	const response = await fetch(url);
	const body = (await response.json()) as ApiResponse<T>;

	if (!response.ok || !body.success) {
		const message = body.success
			? `Request failed with status ${response.status}`
			: body.error.message;

		throw new ApiClientError(message, body.success ? undefined : body.error);
	}

	return body.data;
};

const requestAllPages = async <T>(
	path: string,
	params?: Record<string, string | number | null | undefined>,
): Promise<T[]> => {
	const items: T[] = [];
	let cursor: string | null = null;

	do {
		const page: PageResult<T> = await request(path, {
			...params,
			cursor,
		});

		items.push(...page.items);
		cursor = page.nextCursor;
	} while (cursor);

	return items;
};

export const getRootFolders = async (): Promise<FolderDTO[]> =>
	requestAllPages<FolderDTO>("/folders", { limit: 100 });

export const getFolderItems = async (
	folderId: FolderDTO["id"],
): Promise<FolderItemDTO[]> =>
	requestAllPages<FolderItemDTO>(`/folders/${folderId}/items`, { limit: 100 });

export const getRootFoldersPage = (
	cursor?: string,
): Promise<FolderListResultDTO> =>
	request<FolderListResultDTO>("/folders", { limit: 100, cursor });

export const getFolderItemsPage = (
	folderId: FolderDTO["id"],
	cursor?: string,
): Promise<FolderItemResultDTO> =>
	request<FolderItemResultDTO>(`/folders/${folderId}/items`, {
		limit: 100,
		cursor,
	});

const toFolderNode = (
	folder: Pick<FolderDTO, "id" | "name" | "parentId">,
): FolderNode => ({
	...folder,
	children: [],
	items: [],
	isOpen: false,
	isLoading: false,
	itemsLoaded: false,
});

export const loadFolderNodeItems = async (
	folder: FolderNode,
): Promise<void> => {
	if (folder.itemsLoaded || folder.isLoading) return;

	folder.isLoading = true;
	try {
		const items = await getFolderItems(folder.id);

		folder.items = items;
		folder.children = items
			.filter((item) => item.type === "folder")
			.map((childFolder) =>
				toFolderNode({
					id: childFolder.id,
					name: childFolder.name,
					parentId: folder.id,
				}),
			);
		folder.itemsLoaded = true;
	} finally {
		folder.isLoading = false;
	}
};

export const buildFolderTree = async (): Promise<FolderNode[]> => {
	const rootFolders = await getRootFolders();

	return rootFolders.map(toFolderNode);
};
