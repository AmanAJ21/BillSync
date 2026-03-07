import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/middleware/role';
import AuditLog, { IAuditLog } from '../../../../lib/models/AuditLog';
import connectDB from '../../../../lib/mongoose';
import { handleError, errors } from '../../../../lib/middleware/errorHandler';

/**
 * GET /api/admin/audit-logs
 * Get audit logs with filtering and pagination
 * Requires admin role
 * Validates: Requirements 7.3, 7.4, 7.5
 */
export async function GET(request: NextRequest) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
    await connectDB();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const adminId = searchParams.get('adminId') || undefined;
    const operationType = searchParams.get('operationType') || undefined;
    const targetUserId = searchParams.get('targetUserId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Validate pagination parameters
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return errors.badRequest('Invalid pagination parameters. Page must be >= 1, limit must be 1-100');
    }

    // Build query filter
    const query: any = {};

    // Filter by admin ID
    if (adminId) {
      query.adminId = adminId;
    }

    // Filter by operation type
    if (operationType) {
      // Validate operation type against allowed values
      const validOperationTypes = [
        'auto_payment_enable',
        'auto_payment_disable',
        'payment_attempt',
        'payment_success',
        'payment_failure',
        'payment_retry',
        'consolidated_bill_payment',
        'payment_method_update',
        'payment_method_expired',
        'bill_create',
        'bill_update',
        'bill_delete',
        'bill_bulk_update',
        'bill_bulk_delete',
        'bill_record_create',
        'bill_record_update',
        'bill_record_delete',
        'user_role_change',
        'user_create',
        'user_update',
        'user_delete',
        'config_update',
        'config_create',
        'config_delete',
        'data_export',
        'transaction_update',
        'transaction_delete',
        'transaction_status_change',
      ];

      if (!validOperationTypes.includes(operationType)) {
        return errors.badRequest(
          `Invalid operation type. Must be one of: ${validOperationTypes.join(', ')}`
        );
      }

      query.operationType = operationType;
    }

    // Filter by target user ID
    if (targetUserId) {
      query.targetUserId = targetUserId;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.timestamp = {};

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return errors.badRequest('Invalid startDate format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)');
        }
        query.timestamp.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return errors.badRequest('Invalid endDate format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)');
        }
        query.timestamp.$lte = end;
      }
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST, PUT, DELETE methods are not allowed for audit logs
 * Audit logs are read-only to maintain integrity
 * Validates: Requirement 7.5
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Audit logs cannot be created via API. They are automatically generated.',
      code: 'METHOD_NOT_ALLOWED',
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: 'Audit logs cannot be modified to maintain audit integrity.',
      code: 'METHOD_NOT_ALLOWED',
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Audit logs cannot be deleted to maintain audit integrity.',
      code: 'METHOD_NOT_ALLOWED',
    },
    { status: 405 }
  );
}