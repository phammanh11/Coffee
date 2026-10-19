import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function ok<T>(c: Context, data: T, message = 'Thành công', status: ContentfulStatusCode = 200) {
  return c.json(
    {
      success: true,
      data,
      message,
    },
    status
  );
}

export function fail(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode = 400,
  details?: Record<string, string[]>
) {
  return c.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    status
  );
}
