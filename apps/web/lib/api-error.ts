import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(message: string): never {
  throw new ApiError(404, 'not_found', message);
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'bad_request', message: '请求参数不合法', issues: error.issues },
      { status: 400 },
    );
  }
  console.error('[api] 未处理错误', error);
  return NextResponse.json(
    { error: 'internal_error', message: '服务异常' },
    { status: 500 },
  );
}
