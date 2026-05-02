import { beforeEach, describe, expect, it, mock } from "bun:test";
import { BadRequestError } from "../../../src/errors";
import { SearchService } from "../../../src/services/search.service";
import type { SearchItem, SearchRepository } from "../../../src/types/search";

const mockResults: SearchItem[] = [
	{
		type: "folder",
		id: 1,
		name: "Documents",
		parentId: null,
		path: "/Documents",
	},
	{
		type: "file",
		id: 10,
		name: "notes.txt",
		folderId: 1,
		path: "/Documents/notes.txt",
	},
];

describe("SearchService", () => {
	let service: SearchService;
	let globalSearch: ReturnType<typeof mock>;

	beforeEach(() => {
		globalSearch = mock(() => Promise.resolve(mockResults));

		const repository: SearchRepository = {
			globalSearch,
		};

		service = new SearchService(repository);
	});

	describe("globalSearch", () => {
		it("trims the query before searching", async () => {
			const result = await service.globalSearch("  notes  ");

			expect(result).toEqual(mockResults);
			expect(globalSearch.mock.calls).toEqual([["notes"]]);
		});

		it("throws BadRequestError for whitespace-only queries", async () => {
			await expect(service.globalSearch("   ")).rejects.toBeInstanceOf(
				BadRequestError,
			);
			expect(globalSearch.mock.calls).toEqual([]);
		});
	});
});
