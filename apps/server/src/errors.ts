export class NotFoundError extends Error {
  readonly status = 404;

  constructor(resource: string, id?: number) {
    super(`${resource} ${id ? `with id ${id} ` : ''}not found`);
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
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: string }).code === '23505'
  );
}
