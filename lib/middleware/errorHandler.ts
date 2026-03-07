import { NextResponse } from 'next/server';

/**
 * Error handling middleware
 * Provides consistent error responses across the application
 * Validates: Requirements 4.5, 10.5, 12.2
 * 
 * All error responses follow the format:
 * {
 *   error: string,     // Human-readable error message
 *   code: string,      // Machine-readable error code
 *   details?: unknown  // Optional additional details
 * }
 */

export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
  details?: unknown;
}

/**
 * Create a standardized error response
 */
export function errorResponse(error: ApiError) {
  return NextResponse.json(
    {
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      details: error.details,
    },
    { status: error.statusCode }
  );
}

/**
 * Handle uncaught errors and return appropriate response
 */
export function handleError(error: unknown): NextResponse {
  console.error('Unhandled error:', error);

  // Handle known error types
  if (error instanceof Error) {
    // MongoDB duplicate key error
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      const mongoError = error as any;
      if (mongoError.code === 11000) {
        return errorResponse({
          message: 'A record with this identifier already exists',
          statusCode: 409,
          code: 'DUPLICATE_KEY',
        });
      }
      return errorResponse({
        message: 'Database error occurred',
        statusCode: 500,
        code: 'DATABASE_ERROR',
      });
    }

    // Mongoose validation errors
    if (error.name === 'ValidationError') {
      return errorResponse({
        message: error.message,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    // Mongoose cast errors (invalid ObjectId, etc.)
    if (error.name === 'CastError') {
      return errorResponse({
        message: 'Invalid ID format',
        statusCode: 400,
        code: 'INVALID_ID',
      });
    }

    // JSON parse errors
    if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
      return errorResponse({
        message: 'Invalid JSON in request body',
        statusCode: 400,
        code: 'INVALID_JSON',
      });
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return errorResponse({
        message: 'Request timed out. Please try again.',
        statusCode: 504,
        code: 'TIMEOUT',
      });
    }

    // Connection errors
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      return errorResponse({
        message: 'Service temporarily unavailable. Please try again later.',
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
      });
    }

    // Generic error
    return errorResponse({
      message: error.message || 'Internal server error',
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    });
  }

  // Unknown error type
  return errorResponse({
    message: 'An unexpected error occurred',
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
  });
}

/**
 * Common error responses
 */
export const errors = {
  notFound: (resource: string = 'Resource') =>
    errorResponse({
      message: `${resource} not found`,
      statusCode: 404,
      code: 'NOT_FOUND',
    }),

  unauthorized: (message: string = 'Unauthorized') =>
    errorResponse({
      message,
      statusCode: 401,
      code: 'UNAUTHORIZED',
    }),

  forbidden: (message: string = 'Forbidden') =>
    errorResponse({
      message,
      statusCode: 403,
      code: 'FORBIDDEN',
    }),

  badRequest: (message: string = 'Bad request') =>
    errorResponse({
      message,
      statusCode: 400,
      code: 'BAD_REQUEST',
    }),

  conflict: (message: string = 'Conflict') =>
    errorResponse({
      message,
      statusCode: 409,
      code: 'CONFLICT',
    }),

  internalError: (message: string = 'Internal server error') =>
    errorResponse({
      message,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    }),

  tooManyRequests: (message: string = 'Too many requests. Please try again later.') =>
    errorResponse({
      message,
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
    }),

  methodNotAllowed: (message: string = 'Method not allowed') =>
    errorResponse({
      message,
      statusCode: 405,
      code: 'METHOD_NOT_ALLOWED',
    }),

  validationError: (message: string, details?: unknown) =>
    errorResponse({
      message,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details,
    }),
};

/**
 * Wrap async route handlers with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  }) as T;
}
