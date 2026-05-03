import { Elysia, t } from "elysia";
import { ok } from "types";
import { toSearchResultDTO } from "../mappers/api";
import { SearchRepositoryImpl } from "../repositories/search.repository";
import { SearchService } from "../services/search.service";

const service = new SearchService(new SearchRepositoryImpl());

export const searchRoute = new Elysia({ prefix: "/search" }).get(
	"/",
	async ({ query }) =>
		ok(
			toSearchResultDTO(
				await service.globalSearch(query.q, {
					limit: query.limit,
					cursor: query.cursor,
				}),
			),
		),
	{
		query: t.Object({
			q: t.String({ minLength: 1 }),
			limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
			cursor: t.Optional(t.String({ minLength: 1 })),
		}),
	},
);
