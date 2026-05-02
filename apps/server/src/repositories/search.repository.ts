import { db } from "db";
import { sql } from "drizzle-orm";
import type {
	SearchItem,
	SearchOptions,
	SearchRepository,
	SearchRow,
} from "../types/search";

export class SearchRepositoryImpl implements SearchRepository {
	async globalSearch(
		query: string,
		options: SearchOptions,
	): Promise<SearchItem[]> {
		const cursor = options.cursor;

		const results = await db.execute(sql`
      SELECT
        item_type AS type,
        item_id AS id,
        name,
        CASE
          WHEN item_type = 'folder' THEN parent_folder_id
          ELSE NULL
        END AS "parentId",
        CASE
          WHEN item_type = 'file' THEN parent_folder_id
          ELSE NULL
        END AS "folderId",
        path
      FROM search_index
      WHERE ${
				cursor
					? sql`(item_type, name, item_id) > (${cursor.type}, ${cursor.name}, ${cursor.id})`
					: sql`true`
			}
      AND name ILIKE ${`%${query}%`}
      ORDER BY item_type, name, item_id
      LIMIT ${options.limit}
    `);

		return (results as unknown as SearchRow[]).map((row): SearchItem => {
			if (row.type === "folder") {
				return {
					type: "folder",
					id: row.id,
					name: row.name,
					parentId: row.parentId,
					path: row.path,
				};
			}

			if (row.folderId === null) {
				throw new Error("Search index file row is missing folderId");
			}

			return {
				type: "file",
				id: row.id,
				name: row.name,
				folderId: row.folderId,
				path: row.path,
			};
		});
	}
}
