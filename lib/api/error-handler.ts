import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class APIError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'APIError';
  }
}

export function handleAPIError(error: unknown, version: string = 'v1'): NextResponse {
  console.error('API Error:', error);

  // Handle known error types
  if (error instanceof APIError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
        version,
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: error.errors,
        version,
      },
      { status: 400 }
    );
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint failed
        return NextResponse.json(
          {
            error: 'Resource already exists',
            code: 'DUPLICATE',
            details: { field: error.meta?.target },
            version,
          },
          { status: 409 }
        );
      case 'P2025': // Record not found
        return NextResponse.json(
          {
            error: 'Resource not found',
            code: 'NOT_FOUND',
            version,
          },
          { status: 404 }
        );
      case 'P2003': // Foreign key constraint failed
        return NextResponse.json(
          {
            error: 'Referenced resource not found',
            code: 'FOREIGN_KEY_VIOLATION',
            details: { field: error.meta?.field_name },
            version,
          },
          { status: 400 }
        );
      case 'P2024': // Timed out fetching from database
        return NextResponse.json(
          {
            error: 'Database timeout',
            code: 'TIMEOUT',
            version,
          },
          { status: 408 }
        );
      default:
        return NextResponse.json(
          {
            error: 'Database operation failed',
            code: error.code,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            version,
          },
          { status: 500 }
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      {
        error: 'Invalid database query',
        code: 'VALIDATION_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        version,
      },
      { status: 400 }
    );
  }

  // Handle Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as any;
    
    switch (supabaseError.code) {
      case 'PGRST116':
        return NextResponse.json(
          {
            error: 'Resource not found',
            code: 'NOT_FOUND',
            version,
          },
          { status: 404 }
        );
      case '23505': // Unique constraint violation
        return NextResponse.json(
          {
            error: 'Resource already exists',
            code: 'DUPLICATE',
            version,
          },
          { status: 409 }
        );
      case '23503': // Foreign key constraint violation
        return NextResponse.json(
          {
            error: 'Referenced resource not found',
            code: 'FOREIGN_KEY_VIOLATION',
            version,
          },
          { status: 400 }
        );
      default:
        return NextResponse.json(
          {
            error: supabaseError.message || 'Database error',
            code: supabaseError.code,
            version,
          },
          { status: 500 }
        );
    }
  }

  // Handle network/connection errors
  if (error instanceof Error) {
    if (error.message.includes('fetch')) {
      return NextResponse.json(
        {
          error: 'External service unavailable',
          code: 'SERVICE_UNAVAILABLE',
          version,
        },
        { status: 503 }
      );
    }

    if (error.message.includes('timeout')) {
      return NextResponse.json(
        {
          error: 'Request timeout',
          code: 'TIMEOUT',
          version,
        },
        { status: 408 }
      );
    }
  }

  // Default error response
  return NextResponse.json(
    {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      version,
    },
    { status: 500 }
  );
}

export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any,
  version: string = 'v1'
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      details,
      version,
    },
    { status: statusCode }
  );
}

export function createSuccessResponse(
  data: any,
  message?: string,
  version: string = 'v1'
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      version,
    },
    { status: 200 }
  );
}

// Common error types
export const CommonErrors = {
  UNAUTHORIZED: () => new APIError('Unauthorized', 401, 'UNAUTHORIZED'),
  FORBIDDEN: () => new APIError('Forbidden', 403, 'FORBIDDEN'),
  NOT_FOUND: (resource: string = 'Resource') => new APIError(`${resource} not found`, 404, 'NOT_FOUND'),
  VALIDATION_ERROR: (details: any) => new APIError('Validation failed', 400, 'VALIDATION_ERROR', details),
  CONFLICT: (message: string = 'Resource conflict') => new APIError(message, 409, 'CONFLICT'),
  RATE_LIMITED: () => new APIError('Rate limit exceeded', 429, 'RATE_LIMITED'),
  SERVICE_UNAVAILABLE: () => new APIError('Service unavailable', 503, 'SERVICE_UNAVAILABLE'),
  INTERNAL_ERROR: (message: string = 'Internal server error') => new APIError(message, 500, 'INTERNAL_ERROR'),
};
