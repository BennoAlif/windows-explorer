import {
  foreignKey,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const folders = pgTable(
  'folders',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    parentId: integer('parent_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    }),
    index('idx_folders_parent_id').on(table.parentId),
  ],
);

export const files = pgTable(
  'files',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    folderId: integer('folder_id')
      .references(() => folders.id)
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_files_folder_id').on(table.folderId)],
);
