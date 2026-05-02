import { db } from "./index";
import { files, folders } from "./schema";
import type { InferInsertModel } from "drizzle-orm";

type NewFolder = InferInsertModel<typeof folders>;
type NewFile = InferInsertModel<typeof files>;

const envInt = (name: string, fallback: number) => {
	const raw = process.env[name];
	if (!raw) return fallback;

	const value = Number(raw);
	if (!Number.isInteger(value) || value < 1) {
		throw new Error(`${name} must be a positive integer`);
	}

	return value;
};

const config = {
	rootFolders: envInt("ROOT_FOLDERS", 20),
	foldersPerRoot: envInt("FOLDERS_PER_ROOT", 25),
	filesPerFolder: envInt("FILES_PER_FOLDER", 20),
	batchSize: envInt("BATCH_SIZE", 500),
	token: process.env.LOAD_SEED_TOKEN ?? "perf",
};

const chunk = <T>(items: T[], size: number) => {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
};

const insertFolderBatches = async (rows: NewFolder[]) => {
	for (const batch of chunk(rows, config.batchSize)) {
		await db.insert(folders).values(batch).onConflictDoNothing();
	}
};

const insertFileBatches = async (rows: NewFile[]) => {
	for (const batch of chunk(rows, config.batchSize)) {
		await db.insert(files).values(batch).onConflictDoNothing();
	}
};

async function seed() {
	const totalFolders =
		config.rootFolders + config.rootFolders * config.foldersPerRoot;
	const totalFiles =
		config.rootFolders * config.foldersPerRoot * config.filesPerFolder;

	console.log("Load seed starting...");
	console.log({
		...config,
		totalFolders,
		totalFiles,
	});

	const rootRows = Array.from(
		{ length: config.rootFolders },
		(_, rootIndex) => ({
			name: `${config.token}-root-${String(rootIndex + 1).padStart(5, "0")}`,
		}),
	);

	const roots = await db
		.insert(folders)
		.values(rootRows)
		.onConflictDoNothing()
		.returning({ id: folders.id, name: folders.name });

	if (roots.length < config.rootFolders) {
		throw new Error(
			`Expected ${config.rootFolders} root folders to be inserted. Use a unique LOAD_SEED_TOKEN or an empty database.`,
		);
	}

	const childRows = roots.flatMap((root) =>
		Array.from({ length: config.foldersPerRoot }, (_, folderIndex) => ({
			name: `${config.token}-folder-${String(root.id).padStart(8, "0")}-${String(
				folderIndex + 1,
			).padStart(5, "0")}`,
			parentId: root.id,
		})),
	);

	await insertFolderBatches(childRows);

	const childFolders = await db.query.folders.findMany({
		columns: {
			id: true,
			name: true,
		},
		where: (folder, { like }) => like(folder.name, `${config.token}-folder-%`),
	});

	const fileRows = childFolders.flatMap((folder) =>
		Array.from({ length: config.filesPerFolder }, (_, fileIndex) => ({
			name: `${config.token}-file-${String(folder.id).padStart(8, "0")}-${String(
				fileIndex + 1,
			).padStart(5, "0")}.txt`,
			folderId: folder.id,
		})),
	);

	await insertFileBatches(fileRows);

	console.log("Load seed complete.");
	process.exit(0);
}

seed().catch((error) => {
	console.error(error);
	process.exit(1);
});
