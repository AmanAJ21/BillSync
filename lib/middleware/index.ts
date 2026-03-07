/**
 * Middleware exports
 * Central export point for all middleware functions
 */

// Authentication and authorization
export {
  verifyAuth,
  verifyOwnership,
  unauthorizedResponse,
  forbiddenResponse,
  type AuthResult,
} from './auth';

// Role-based authorization
export {
  requireAdmin,
  requireRole,
} from './role';

// Request validation
export {
  validateRequestBody,
  validateQueryParams,
  validationErrorResponse,
  schemas,
} from './validation';

// Error handling
export {
  errorResponse,
  handleError,
  errors,
  withErrorHandler,
  type ApiError,
} from './errorHandler';

// Audit logging
export {
  auditLog,
  createAuditLogWithState,
} from './audit';
