import { BadRequestError, NotFoundError } from "../errors";
import type {
	CreateFolderDTO,
	Folder,
	FolderCursor,
	FolderItemCursor,
	FolderItemResult,
	FolderListResult,
	FolderRepository,
	UpdateFolderDTO,
} from "../types/folder";

const DEFAULT_FOLDER_LIMIT = 50;
const MAX_FOLDER_LIMIT = 100;

const normalizeLimit = (limit?: number): number =>
	Math.min(Math.max(limit ?? DEFAULT_FOLDER_LIMIT, 1), MAX_FOLDER_LIMIT);

const encodeCursor = (cursor: FolderCursor | FolderItemCursor): string =>
	Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

const decodeFolderCursor = (cursor: string): FolderCursor => {
	try {
		const parsed = JSON.parse(
			Buffer.from(cursor, "base64url").toString("utf8"),
		) as Partial<FolderCursor>;

		if (typeof parsed.name !== "string" || typeof parsed.id !== "number") {
			throw new Error("Invalid cursor format");
		}

		return {
			name: parsed.name,
			id: parsed.id,
		};
	} catch {
		throw new BadRequestError("Invalid cursor");
	}
};

const decodeFolderItemCursor = (cursor: string): FolderItemCursor => {
	try {
		const parsed = JSON.parse(
			Buffer.from(cursor, "base64url").toString("utf8"),
		) as Partial<FolderItemCursor>;

		if (
			(parsed.type !== "folder" && parsed.type !== "file") ||
			typeof parsed.name !== "string" ||
			typeof parsed.id !== "number"
		) {
			throw new Error("Invalid cursor format");
		}

		return {
			type: parsed.type,
			name: parsed.name,
			id: parsed.id,
		};
	} catch {
		throw new BadRequestError("Invalid cursor");
	}
};

export class FolderService {
	constructor(private folderRepository: FolderRepository) {}

	async getAll(options?: {
		limit?: number;
		cursor?: string;
	}): Promise<FolderListResult> {
		const limit = normalizeLimit(options?.limit);
		const decodedCursor = options?.cursor
			? decodeFolderCursor(options.cursor)
			: undefined;
		const rows = await this.folderRepository.getRootPage({
			limit: limit + 1,
			cursor: decodedCursor,
		});

		const hasMore = rows.length > limit;
		const items = hasMore ? rows.slice(0, limit) : rows;
		const lastItem = items.at(-1);
		const nextCursor =
			hasMore && lastItem
				? encodeCursor({
						name: lastItem.name,
						id: lastItem.id,
					})
				: null;

		return {
			items,
			nextCursor,
		};
	}

	private async getById(id: Folder["id"]): Promise<Folder> {
		const folder = await this.folderRepository.getById(id);
		if (!folder) throw new NotFoundError("Folder", id);
		return folder;
	}

	async getItemsByFolderId(
		folderId: Folder["id"],
		options?: {
			limit?: number;
			cursor?: string;
		},
	): Promise<FolderItemResult> {
		await this.getById(folderId);
		const limit = normalizeLimit(options?.limit);
		const decodedCursor = options?.cursor
			? decodeFolderItemCursor(options.cursor)
			: undefined;
		const rows = await this.folderRepository.getItemsByFolderId(folderId, {
			limit: limit + 1,
			cursor: decodedCursor,
		});

		const hasMore = rows.length > limit;
		const items = hasMore ? rows.slice(0, limit) : rows;
		const lastItem = items.at(-1);
		const nextCursor =
			hasMore && lastItem
				? encodeCursor({
						type: lastItem.type,
						name: lastItem.name,
						id: lastItem.id,
					})
				: null;

		return {
			items,
			nextCursor,
		};
	}

	async create(data: CreateFolderDTO): Promise<Folder> {
		if (data.parentId !== undefined && data.parentId !== null) {
			const parent = await this.folderRepository.getById(data.parentId);
			if (!parent) throw new NotFoundError("Parent folder", data.parentId);
		}
		return await this.folderRepository.create({
			...data,
			name: data.name.trim(),
		});
	}

	async update(id: Folder["id"], data: UpdateFolderDTO): Promise<Folder> {
		await this.getById(id);
		if (data.parentId !== undefined && data.parentId !== null) {
			if (data.parentId === id)
				throw new BadRequestError("A folder cannot be its own parent");
			const parent = await this.folderRepository.getById(data.parentId);
			if (!parent) throw new NotFoundError("Parent folder", data.parentId);
		}
		return await this.folderRepository.update(id, {
			...data,
			...(data.name && { name: data.name.trim() }),
		});
	}

	async delete(id: Folder["id"]): Promise<void> {
		await this.getById(id);
		return await this.folderRepository.delete(id);
	}
}
