import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from './auth';
import AuditLog from '../models/AuditLog';

/**
 * Audit logging middleware for admin operations
 * Automatically creates audit log entries for admin actions
 * Validates: Requirements 7.1, 7.2
 */

interface AuditLogOptions {
  operationType:
  | 'bill_create'
  | 'bill_update'
  | 'bill_delete'
  | 'bill_bulk_update'
  | 'bill_bulk_delete'
  | 'bill_record_create'
  | 'bill_record_update'
  | 'bill_record_delete'
  | 'user_role_change'
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'config_update'
  | 'config_create'
  | 'config_delete'
  | 'data_export'
  | 'transaction_update'
  | 'transaction_delete'
  | 'transaction_status_change';
  entityType: 'bill' | 'bill_record' | 'user' | 'system_config' | 'transaction';
}

/**
 * Extract entity ID from URL path
 * Handles patterns like /api/admin/bills/[billId] or /api/admin/users/[userId]/role
 */
function extractEntityId(path: string): string | undefined {
  // Match patterns like /api/admin/bills/123 or /api/admin/templates/456
  const patterns = [
    /\/api\/admin\/bills\/([^\/]+)(?:\/|$)/,
    /\/api\/admin\/users\/([^\/]+)(?:\/|$)/,
    /\/api\/admin\/config\/([^\/]+)(?:\/|$)/,
    /\/api\/admin\/transactions\/([^\/]+)(?:\/|$)/,
    /\/api\/admin\/bills\/[^\/]+\/records\/([^\/]+)(?:\/|$)/,
  ];

  for (const pattern of patterns) {
    const match = path.match(pattern);
    if (match && match[1] !== 'bulk' && match[1] !== 'route') {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Extract target user ID from request body or path
 * Used for operations that affect other users
 */
function extractTargetUserId(path: string, body: any): string | undefined {
  // Check if body has userId field (for bill creation, etc.)
  if (body && body.userId) {
    return body.userId;
  }

  // Check if path contains user ID (for user-specific operations)
  const userIdMatch = path.match(/\/api\/admin\/users\/([^\/]+)/);
  if (userIdMatch && userIdMatch[1] !== 'route') {
    return userIdMatch[1];
  }

  return undefined;
}

/**
 * Sanitize request body for logging
 * Removes sensitive information like passwords
 */
function sanitizeBody(body: any): any {
  if (!body) return {};

  const sanitized = { ...body };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'cvv'];
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Middleware wrapper for audit logging
 * Wraps a route handler and automatically creates audit logs for successful operations
 * 
 * @param options - Configuration for the audit log entry
 * @param handler - The route handler function to wrap
 * @returns Wrapped handler with audit logging
 * 
 * @example
 * export const POST = auditLog(
 *   { operationType: 'bill_create', entityType: 'bill' },
 *   async (request: NextRequest) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true });
 *   }
 * );
 */
export function auditLog(
  options: AuditLogOptions,
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const startTime = Date.now();
    let requestBody: any = null;

    // Try to parse request body for logging (only for non-GET requests)
    if (request.method !== 'GET') {
      try {
        // Clone the request to read the body without consuming it
        const clonedRequest = request.clone();
        requestBody = await clonedRequest.json();
      } catch (error) {
        // Body might not be JSON or might be empty, that's okay
        requestBody = null;
      }
    }

    // Get authenticated user info
    const authResult = await verifyAuth(request);
    const adminId = authResult.authenticated ? authResult.user?.id : undefined;

    // Execute the handler
    const response = await handler(request, context);

    // Only log if the operation was successful (2xx status code)
    if (response.status >= 200 && response.status < 300) {
      try {
        const duration = Date.now() - startTime;
        const path = request.nextUrl.pathname;
        const entityId = extractEntityId(path);
        const targetUserId = extractTargetUserId(path, requestBody);

        // Create audit log entry
        await AuditLog.create({
          userId: adminId || 'unknown',
          adminId: adminId,
          operation: `${request.method} ${path}`,
          operationType: options.operationType,
          entityType: options.entityType,
          entityId: entityId,
          targetUserId: targetUserId,
          details: {
            method: request.method,
            path: path,
            body: sanitizeBody(requestBody),
            duration: duration,
            statusCode: response.status,
          },
          status: 'success',
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || undefined,
          timestamp: new Date(),
        });
      } catch (error) {
        // Log the error but don't fail the request
        console.error('Failed to create audit log:', error);
      }
    }

    return response;
  };
}

/**
 * Create audit log entry with before/after state tracking
 * Used for update operations where we need to track state changes
 * 
 * @param adminId - ID of the admin performing the operation
 * @param operationType - Type of operation being performed
 * @param entityType - Type of entity being modified
 * @param entityId - ID of the entity being modified
 * @param beforeState - State before the operation
 * @param afterState - State after the operation
 * @param request - The NextRequest object for extracting request details
 */
export async function createAuditLogWithState(
  adminId: string,
  operationType: AuditLogOptions['operationType'],
  entityType: AuditLogOptions['entityType'],
  entityId: string,
  beforeState: Record<string, any>,
  afterState: Record<string, any>,
  request: NextRequest
): Promise<void> {
  try {
    await AuditLog.create({
      userId: adminId,
      adminId: adminId,
      operation: `${request.method} ${request.nextUrl.pathname}`,
      operationType: operationType,
      entityType: entityType,
      entityId: entityId,
      beforeState: beforeState,
      afterState: afterState,
      details: {
        method: request.method,
        path: request.nextUrl.pathname,
      },
      status: 'success',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to create audit log with state:', error);
  }
}
