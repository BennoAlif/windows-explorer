import type { AnyElysia } from "elysia";
import {
	BadRequestError,
	ConflictError,
	InternalServerError,
	NotFoundError,
} from "../errors";
import { type ApiErrorDetail, fail } from "../types/api";

const ERROR_CODES = {
	BadRequestError: "BAD_REQUEST",
	ConflictError: "CONFLICT",
	InternalServerError: "INTERNAL_SERVER_ERROR",
	NotFoundError: "NOT_FOUND",
} as const;

type ValidationIssue = {
	path?: string;
	message?: unknown;
	summary?: string;
};

const formatValidationPath = (path: string | undefined): string => {
	if (!path || path === "/") return "";
	return path.replace(/^\//, "").replaceAll("/", ".");
};

const normalizeValidationDetails = (error: unknown): ApiErrorDetail[] => {
	if (
		typeof error !== "object" ||
		error === null ||
		!("all" in error) ||
		!Array.isArray(error.all)
	) {
		return [];
	}

	return error.all.map((issue: ValidationIssue) => ({
		path: formatValidationPath(issue.path),
		message:
			issue.summary ??
			(typeof issue.message === "string" ? issue.message : "Invalid value"),
	}));
};

const getErrorStatus = (error: unknown): number | null => {
	if (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof error.status === "number"
	) {
		return error.status;
	}

	return null;
};

const getErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : "Internal server error";

const getAppErrorCode = (error: unknown): string | null => {
	if (error instanceof NotFoundError) return ERROR_CODES.NotFoundError;
	if (error instanceof ConflictError) return ERROR_CODES.ConflictError;
	if (error instanceof BadRequestError) return ERROR_CODES.BadRequestError;
	if (error instanceof InternalServerError)
		return ERROR_CODES.InternalServerError;
	return null;
};

export const withErrorHandling = <T extends AnyElysia>(app: T) =>
	app
		.error({
			NotFoundError,
			ConflictError,
			BadRequestError,
			InternalServerError,
		})
		.onError(({ code, error, set }) => {
			if (code === "VALIDATION") {
				set.status = 422;
				return fail(
					"VALIDATION_ERROR",
					"Validation failed",
					normalizeValidationDetails(error),
				);
			}

			const status = getErrorStatus(error);
			const appErrorCode = getAppErrorCode(error);
			if (status && appErrorCode) {
				set.status = status;
				return fail(appErrorCode, getErrorMessage(error));
			}

			set.status = 500;
			return fail("INTERNAL_SERVER_ERROR", "Internal server error");
		});
