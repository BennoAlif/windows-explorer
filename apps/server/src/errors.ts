export class NotFoundError extends Error {
	readonly status = 404;

	constructor(resource: string, id?: number) {
		super(`${resource} ${id ? `with id ${id} ` : ""}not found`);
	}
}

export class ConflictError extends Error {
	readonly status = 409;
}

export class BadRequestError extends Error {
	readonly status = 400;
}

export class InternalServerError extends Error {
	readonly status = 500;
}

export function isUniqueViolation(e: unknown): boolean {
	const hasUniqueViolationCode = (value: unknown): boolean =>
		typeof value === "object" &&
		value !== null &&
		"code" in value &&
		(value as { code: string }).code === "23505";

	return (
		hasUniqueViolationCode(e) ||
		(typeof e === "object" &&
			e !== null &&
			"cause" in e &&
			hasUniqueViolationCode(e.cause))
	);
}
