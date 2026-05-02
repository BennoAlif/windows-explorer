import { db, files } from "db";
import { eq } from "drizzle-orm";
import {
	ConflictError,
	InternalServerError,
	isUniqueViolation,
	NotFoundError,
} from "../errors";
import type {
	CreateFileDTO,
	FileEntity,
	FileRepository,
	UpdateFileDTO,
} from "../types/file";

export class FileRepositoryImpl implements FileRepository {
	async getById(id: FileEntity["id"]): Promise<FileEntity | null> {
		const [file] = await db
			.select({
				id: files.id,
				name: files.name,
				folderId: files.folderId,
				createdAt: files.createdAt,
				updatedAt: files.updatedAt,
			})
			.from(files)
			.where(eq(files.id, id));
		return file ?? null;
	}
	async getAllByFolderId(
		folderId: FileEntity["folderId"],
	): Promise<FileEntity[]> {
		return await db
			.select({
				id: files.id,
				name: files.name,
				folderId: files.folderId,
				createdAt: files.createdAt,
				updatedAt: files.updatedAt,
			})
			.from(files)
			.where(eq(files.folderId, folderId));
	}
	async create(data: CreateFileDTO): Promise<FileEntity> {
		try {
			const [file] = await db.insert(files).values(data).returning();
			if (!file) throw new InternalServerError("Failed to create file");
			return file;
		} catch (e) {
			if (isUniqueViolation(e)) {
				throw new ConflictError(`File "${data.name}" already exists`);
			}
			throw e;
		}
	}
	async update(id: FileEntity["id"], data: UpdateFileDTO): Promise<FileEntity> {
		try {
			const [file] = await db
				.update(files)
				.set(data)
				.where(eq(files.id, id))
				.returning();
			if (!file) {
				throw new NotFoundError("File", id);
			}
			return file;
		} catch (e) {
			if (isUniqueViolation(e)) {
				throw new ConflictError(`File "${data.name}" already exists`);
			}
			throw e;
		}
	}
	async delete(id: FileEntity["id"]): Promise<void> {
		const deleted = await db.delete(files).where(eq(files.id, id)).returning();
		if (!deleted.length) {
			throw new NotFoundError("File", id);
		}
	}
}
