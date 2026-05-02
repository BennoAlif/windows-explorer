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
      WITH RECURSIVE folder_paths AS (
        SELECT
          id,
          name,
          parent_id,
          ('/' || name)::text AS path
        FROM folders
        WHERE parent_id IS NULL

        UNION ALL

        SELECT
          f.id,
          f.name,
          f.parent_id,
          folder_paths.path || '/' || f.name AS path
        FROM folders f
        JOIN folder_paths ON f.parent_id = folder_paths.id
      ),
      search_results AS (
        SELECT
          'folder' AS type,
          id,
          name,
          parent_id AS "parentId",
          NULL::integer AS "folderId",
          path
        FROM folder_paths
        WHERE name ILIKE ${`%${query}%`}

        UNION ALL

        SELECT
          'file' AS type,
          files.id,
          files.name,
          NULL::integer AS "parentId",
          files.folder_id AS "folderId",
          folder_paths.path || '/' || files.name AS path
        FROM files
        JOIN folder_paths ON files.folder_id = folder_paths.id
        WHERE files.name ILIKE ${`%${query}%`}
      )
      SELECT *
      FROM search_results
      WHERE ${
				cursor
					? sql`(type, name, id) > (${cursor.type}, ${cursor.name}, ${cursor.id})`
					: sql`true`
			}
      ORDER BY type, name, id
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

			return {
				type: "file",
				id: row.id,
				name: row.name,
				folderId: row.folderId!,
				path: row.path,
			};
		});
	}
}
