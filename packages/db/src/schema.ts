import { sql } from "drizzle-orm";
import {
	foreignKey,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const folders = pgTable(
	"folders",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		parentId: integer("parent_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "fk_folders_parent_id",
		}).onDelete("cascade"),
		index("idx_folders_parent_id").on(table.parentId),
		uniqueIndex("uq_folders_parent_name").on(
			sql`coalesce(${table.parentId}, 0)`,
			table.name,
		),
	],
);

export const files = pgTable(
	"files",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		folderId: integer("folder_id").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.folderId],
			foreignColumns: [folders.id],
			name: "fk_files_folder_id",
		}).onDelete("cascade"),

		index("idx_files_folder_id").on(table.folderId),

		uniqueIndex("uq_files_folder_name").on(table.folderId, table.name),
	],
);
