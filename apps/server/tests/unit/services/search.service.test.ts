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

			expect(result).toEqual({
				items: mockResults,
				nextCursor: null,
			});
			expect(globalSearch.mock.calls).toEqual([
				["notes", { limit: 51, cursor: undefined }],
			]);
		});

		it("returns a next cursor when there are more rows than the requested limit", async () => {
			const result = await service.globalSearch("notes", { limit: 1 });

			expect(result.items).toEqual([mockResults[0]!]);
			expect(typeof result.nextCursor).toBe("string");
			expect(globalSearch.mock.calls).toEqual([
				["notes", { limit: 2, cursor: undefined }],
			]);
		});

		it("decodes a valid cursor before searching", async () => {
			const cursor = Buffer.from(
				JSON.stringify({ type: "file", name: "notes.txt", id: 10 }),
				"utf8",
			).toString("base64url");

			await service.globalSearch("notes", { limit: 10, cursor });

			expect(globalSearch.mock.calls).toEqual([
				[
					"notes",
					{
						limit: 11,
						cursor: { type: "file", name: "notes.txt", id: 10 },
					},
				],
			]);
		});

		it("throws BadRequestError for invalid cursors", async () => {
			await expect(
				service.globalSearch("notes", { cursor: "not-a-valid-cursor" }),
			).rejects.toBeInstanceOf(BadRequestError);
			expect(globalSearch.mock.calls).toEqual([]);
		});

		it("throws BadRequestError for whitespace-only queries", async () => {
			await expect(service.globalSearch("   ")).rejects.toBeInstanceOf(
				BadRequestError,
			);
			expect(globalSearch.mock.calls).toEqual([]);
		});
	});
});
