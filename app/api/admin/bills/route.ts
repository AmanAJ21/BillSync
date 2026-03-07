import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/middleware/role';
import { auditLog } from '../../../../lib/middleware/audit';
import { adminBillService } from '../../../../lib/services/AdminBillService';
import { verifyAuth } from '../../../../lib/middleware/auth';
import { handleError, errors } from '../../../../lib/middleware/errorHandler';
import { validateRequestBody, schemas } from '../../../../lib/middleware/validation';

/**
 * GET /api/admin/bills
 * Get all bills with filtering and pagination
 * Requires admin role
 * Validates: Requirements 4.6
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
    const limit = parseInt(searchParams.get('limit') || '10');
    const userId = searchParams.get('userId') || undefined;
    const endDateParam = searchParams.get('endDate');
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    // Validate pagination parameters
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return errors.badRequest('Invalid pagination parameters. Page must be >= 1, limit must be 1-100');
    }

    // Validate date parameter
    if (endDate && isNaN(endDate.getTime())) {
      return errors.badRequest('Invalid endDate format. Use ISO 8601 format');
    }

    // Get bills with filters and pagination
    const result = await adminBillService.getAllBills(
      { userId, endDate },
      { page, limit }
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/admin/bills
 * Create a new bill for a user
 * Requires admin role
 * Validates: Requirements 4.1, 4.4, 4.5
 */
export const POST = auditLog(
  { operationType: 'bill_create', entityType: 'bill' },
  async (request: NextRequest) => {
    // Check admin authorization
    const authCheck = await requireAdmin(request);
    if (authCheck) {
      return authCheck; // Return error response
    }

    try {
      // Get authenticated admin user
      const authResult = await verifyAuth(request);
      if (!authResult.authenticated || !authResult.user) {
        return errors.unauthorized('Authentication required');
      }

      // Parse request body
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errors.badRequest('Invalid JSON in request body');
      }

      // Validate with Zod schema
      const validation = await validateRequestBody(body, schemas.createBill);
      if (!validation.success) {
        return errors.badRequest(validation.error);
      }

      const { billNumber, customerName, provider, billType, amount, dueDay, billingFrequency } = validation.data;

      // Create bill
      let newBill;
      try {
        newBill = await adminBillService.createBill(
          {
            billNumber,
            customerName,
            provider,
            billType,
            amount,
            dueDay,
            billingFrequency,
          },
          authResult.user.id
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('bill number already exists')) {
          return errors.conflict('A bill with this bill number already exists');
        }
        throw error;
      }

      return NextResponse.json(
        { success: true, bill: newBill },
        { status: 201 }
      );
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('User not found')) {
          return errors.notFound('User');
        }
      }

      return handleError(error);
    }
  }
);