import { BadRequestError } from "../errors";
import type {
	SearchCursor,
	SearchRepository,
	SearchResult,
} from "../types/search";

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 100;

const encodeCursor = (cursor: SearchCursor): string => {
	return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
};

const decodeCursor = (cursor: string): SearchCursor => {
	try {
		const parsed = JSON.parse(
			Buffer.from(cursor, "base64url").toString("utf8"),
		) as Partial<SearchCursor>;

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

export class SearchService {
	constructor(private searchRepository: SearchRepository) {}

	async globalSearch(
		query: string,
		options?: {
			limit?: number;
			cursor?: string;
		},
	): Promise<SearchResult> {
		const searchQuery = query.trim();

		if (!searchQuery) {
			throw new BadRequestError("Query cannot be empty");
		}

		const limit = Math.min(
			Math.max(options?.limit ?? DEFAULT_SEARCH_LIMIT, 1),
			MAX_SEARCH_LIMIT,
		);

		const decodedCursor = options?.cursor
			? decodeCursor(options.cursor)
			: undefined;

		const rows = await this.searchRepository.globalSearch(searchQuery, {
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
}
