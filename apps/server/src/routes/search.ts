import { Elysia, t } from "elysia";
import { SearchRepositoryImpl } from "../repositories/search.repository";
import { SearchService } from "../services/search.service";
import { ok } from "../types/api";

const service = new SearchService(new SearchRepositoryImpl());

export const searchRoute = new Elysia({ prefix: "/search" }).get(
	"/",
	async ({ query }) => ok(await service.globalSearch(query.q)),
	{
		query: t.Object({ q: t.String({ minLength: 1 }) }),
	},
);
