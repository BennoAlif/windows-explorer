export type ApiErrorDetail = {
	path: string;
	message: string;
};

export type ApiError = {
	code: string;
	message: string;
	details?: ApiErrorDetail[];
};

export type ApiSuccess<T> = {
	success: true;
	data: T;
	error: null;
};

export type ApiFailure = {
	success: false;
	data: null;
	error: ApiError;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const ok = <T>(data: T): ApiSuccess<T> => ({
	success: true,
	data,
	error: null,
});

export const fail = (
	code: string,
	message: string,
	details?: ApiErrorDetail[],
): ApiFailure => ({
	success: false,
	data: null,
	error: {
		code,
		message,
		...(details?.length ? { details } : {}),
	},
});
