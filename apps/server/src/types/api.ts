export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: string | null;
};

export const ok = <T>(data: T): ApiResponse<T> => ({
  success: true,
  data,
  error: null,
});

export const fail = <T>(error: string): ApiResponse<T> => ({
  success: false,
  data: null,
  error,
});
