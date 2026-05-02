import { db, files, folders } from "db";
import { eq, sql } from "drizzle-orm";
import {
	ConflictError,
	InternalServerError,
	isUniqueViolation,
	NotFoundError,
} from "../errors";
import type {
	CreateFolderDTO,
	Folder,
	FolderItem,
	FolderItemPageOptions,
	FolderPageOptions,
	FolderRepository,
	UpdateFolderDTO,
} from "../types/folder";

type FolderRow = {
	id: number;
	name: string;
	parentId: number | null;
	createdAt: Date;
	updatedAt: Date;
};

type FolderItemRow = {
	type: "folder" | "file";
	id: number;
	name: string;
};

export class FolderRepositoryImpl implements FolderRepository {
	async getRootPage(options: FolderPageOptions): Promise<Folder[]> {
		const cursor = options.cursor;
		const results = await db.execute(sql`
			SELECT
				id,
				name,
				parent_id AS "parentId",
				created_at AS "createdAt",
				updated_at AS "updatedAt"
			FROM ${folders}
			WHERE parent_id IS NULL
			AND ${
				cursor ? sql`(name, id) > (${cursor.name}, ${cursor.id})` : sql`true`
			}
			ORDER BY name, id
			LIMIT ${options.limit}
		`);

		return results as unknown as FolderRow[];
	}

	async getItemsByFolderId(
		folderId: Folder["id"],
		options: FolderItemPageOptions,
	): Promise<FolderItem[]> {
		const cursor = options.cursor;
		const results = await db.execute(sql`
			WITH folder_items AS (
				SELECT
					'folder' AS type,
					id,
					name
				FROM ${folders}
				WHERE parent_id = ${folderId}

				UNION ALL

				SELECT
					'file' AS type,
					id,
					name
				FROM ${files}
				WHERE folder_id = ${folderId}
			)
			SELECT *
			FROM folder_items
			WHERE ${
				cursor
					? sql`(type, name, id) > (${cursor.type}, ${cursor.name}, ${cursor.id})`
					: sql`true`
			}
			ORDER BY type, name, id
			LIMIT ${options.limit}
		`);

		return (results as unknown as FolderItemRow[]).map((row) => {
			if (row.type === "folder") {
				return {
					type: "folder",
					id: row.id,
					name: row.name,
				};
			}

			return {
				type: "file",
				id: row.id,
				name: row.name,
			};
		});
	}

	async getById(id: Folder["id"]): Promise<Folder | null> {
		const [folder] = await db
			.select({
				id: folders.id,
				name: folders.name,
				parentId: folders.parentId,
				createdAt: folders.createdAt,
				updatedAt: folders.updatedAt,
			})
			.from(folders)
			.where(eq(folders.id, id));
		return folder ?? null;
	}

	async create(data: CreateFolderDTO): Promise<Folder> {
		try {
			const [folder] = await db.insert(folders).values(data).returning();
			if (!folder) throw new InternalServerError("Failed to create folder");
			return folder;
		} catch (e) {
			if (isUniqueViolation(e))
				throw new ConflictError(`Folder "${data.name}" already exists`);
			throw e;
		}
	}
	async update(id: Folder["id"], data: UpdateFolderDTO): Promise<Folder> {
		try {
			const [folder] = await db
				.update(folders)
				.set(data)
				.where(eq(folders.id, id))
				.returning();
			if (!folder) {
				throw new NotFoundError("Folder", id);
			}
			return folder;
		} catch (e) {
			if (isUniqueViolation(e))
				throw new ConflictError(`Folder "${data.name}" already exists`);
			throw e;
		}
	}
	async delete(id: Folder["id"]): Promise<void> {
		const deleted = await db
			.delete(folders)
			.where(eq(folders.id, id))
			.returning();
		if (!deleted.length) {
			throw new NotFoundError("Folder", id);
		}
	}
}
