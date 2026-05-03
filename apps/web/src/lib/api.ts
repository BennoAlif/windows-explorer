import type {
	ApiError,
	ApiResponse,
	CreateFileInput,
	CreateFolderInput,
	FileDTO,
	FolderDTO,
	FolderItemDTO,
	FolderItemResultDTO,
	FolderListResultDTO,
	SearchResultDTO,
	UpdateFileInput,
	UpdateFolderInput,
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
	childrenLoaded: boolean;
	nextCursor: string | null;
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
	init?: RequestInit,
): Promise<T> => {
	const url = new URL(`${API_BASE_URL}${path}`);

	for (const [key, value] of Object.entries(params ?? {})) {
		if (value !== undefined && value !== null) {
			url.searchParams.set(key, String(value));
		}
	}

	const response = await fetch(url, init);
	const body = (await response.json()) as ApiResponse<T>;

	if (!response.ok || !body.success) {
		const message = body.success
			? `Request failed with status ${response.status}`
			: body.error.message;

		throw new ApiClientError(message, body.success ? undefined : body.error);
	}

	return body.data;
};

const requestJson = async <T>(
	path: string,
	method: "POST" | "PATCH" | "DELETE",
	body?: unknown,
): Promise<T> =>
	request<T>(path, undefined, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});

export const getRootFoldersPage = (
	cursor?: string,
): Promise<FolderListResultDTO> =>
	request<FolderListResultDTO>("/folders", { limit: 25, cursor });

export const getFolderItemsPage = (
	folderId: FolderDTO["id"],
	cursor?: string,
): Promise<FolderItemResultDTO> =>
	request<FolderItemResultDTO>(`/folders/${folderId}/items`, {
		limit: 25,
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
	childrenLoaded: false,
	nextCursor: null,
});

export const createFolder = (data: CreateFolderInput): Promise<FolderDTO> =>
	requestJson<FolderDTO>("/folders", "POST", data);

export const updateFolder = (
	id: FolderDTO["id"],
	data: UpdateFolderInput,
): Promise<FolderDTO> =>
	requestJson<FolderDTO>(`/folders/${id}`, "PATCH", data);

export const deleteFolder = (id: FolderDTO["id"]): Promise<null> =>
	requestJson<null>(`/folders/${id}`, "DELETE");

export const createFile = (
	folderId: FolderDTO["id"],
	data: CreateFileInput,
): Promise<FileDTO> =>
	requestJson<FileDTO>(`/folders/${folderId}/files`, "POST", data);

export const updateFile = (
	id: FileDTO["id"],
	data: UpdateFileInput,
): Promise<FileDTO> => requestJson<FileDTO>(`/files/${id}`, "PATCH", data);

export const deleteFile = (id: FileDTO["id"]): Promise<null> =>
	requestJson<null>(`/files/${id}`, "DELETE");

export const folderDTOToNode = toFolderNode;

const appendFolderItemsPage = (
	folder: FolderNode,
	page: FolderItemResultDTO,
): void => {
	const childFolders = page.items.filter((item) => item.type === "folder");

	folder.items.push(...page.items);
	folder.children.push(
		...childFolders.map((childFolder) =>
			toFolderNode({
				id: childFolder.id,
				name: childFolder.name,
				parentId: folder.id,
			}),
		),
	);
	folder.nextCursor = page.nextCursor;

	const pageHasFiles = page.items.some((item) => item.type === "file");
	folder.childrenLoaded = pageHasFiles || page.nextCursor === null;
};

export const loadFolderNodeItems = async (
	folder: FolderNode,
): Promise<void> => {
	if (folder.itemsLoaded || folder.isLoading) return;

	folder.isLoading = true;
	try {
		const page = await getFolderItemsPage(folder.id);

		folder.items = [];
		folder.children = [];
		appendFolderItemsPage(folder, page);
		folder.itemsLoaded = true;
	} finally {
		folder.isLoading = false;
	}
};

export const loadMoreFolderNodeItems = async (
	folder: FolderNode,
): Promise<void> => {
	if (!folder.itemsLoaded || !folder.nextCursor || folder.isLoading) return;

	folder.isLoading = true;
	try {
		const page = await getFolderItemsPage(folder.id, folder.nextCursor);

		appendFolderItemsPage(folder, page);
	} finally {
		folder.isLoading = false;
	}
};

export const loadFolderNodeChildren = async (
	folder: FolderNode,
): Promise<void> => {
	if (!folder.itemsLoaded) {
		await loadFolderNodeItems(folder);
	}

	while (!folder.childrenLoaded && folder.nextCursor) {
		await loadMoreFolderNodeItems(folder);
	}
};

export const loadRootFolderPage = async (
	cursor?: string | null,
): Promise<{ folders: FolderNode[]; nextCursor: string | null }> => {
	const page = await getRootFoldersPage(cursor ?? undefined);

	return {
		folders: page.items.map(toFolderNode),
		nextCursor: page.nextCursor,
	};
};

export const buildFolderTree = async (): Promise<FolderNode[]> => {
	const page = await loadRootFolderPage();

	return page.folders;
};

export const searchPage = (
	query: string,
	cursor?: string,
): Promise<SearchResultDTO> =>
	request<SearchResultDTO>("/search", { q: query, limit: 25, cursor });
