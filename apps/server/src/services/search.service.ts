import { BadRequestError } from "../errors";
import type { SearchItem, SearchRepository } from "../types/search";

export class SearchService {
	constructor(private searchRepository: SearchRepository) {}

	async globalSearch(query: string): Promise<SearchItem[]> {
		const searchQuery = query.trim();

		if (!searchQuery) {
			throw new BadRequestError("Query cannot be empty");
		}

		return await this.searchRepository.globalSearch(searchQuery);
	}
}
