import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/middleware/role';
import { manualPaymentService } from '@/lib/services/ManualPaymentService';
import { handleError, errors } from '@/lib/middleware/errorHandler';

/**
 * GET /api/admin/payments/manual
 * Get all manual payments with filtering and pagination
 * Requires admin role
 */
export async function GET(request: NextRequest) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId') || undefined;
    const billId = searchParams.get('billId') || undefined;
    const status = searchParams.get('status') as 'success' | 'failed' | 'pending' | null;
    const billType = searchParams.get('billType') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Validate pagination
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return errors.badRequest('Invalid pagination parameters. Page must be >= 1, limit must be 1-100');
    }

    // Build filters
    const filters: any = {};

    if (userId) {
      filters.userId = userId;
    }

    if (billId) {
      filters.billId = billId;
    }

    if (status) {
      if (!['success', 'failed', 'pending'].includes(status)) {
        return errors.badRequest('Invalid status. Must be success, failed, or pending');
      }
      filters.status = status;
    }

    if (billType) {
      filters.billType = billType;
    }

    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return errors.badRequest('Invalid startDate format. Use ISO 8601 format');
      }
      filters.startDate = start;
    }

    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return errors.badRequest('Invalid endDate format. Use ISO 8601 format');
      }
      filters.endDate = end;
    }

    // Get payments
    const result = await manualPaymentService.getPayments(filters, page, limit);

    return NextResponse.json({
      payments: result.payments,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
