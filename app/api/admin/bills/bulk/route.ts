import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/middleware/role';
import { auditLog } from '../../../../../lib/middleware/audit';
import { adminBillService } from '../../../../../lib/services/AdminBillService';
import { verifyAuth } from '../../../../../lib/middleware/auth';
import { handleError, errors } from '../../../../../lib/middleware/errorHandler';
import { validateRequestBody, schemas } from '../../../../../lib/middleware/validation';

/**
 * POST /api/admin/bills/bulk
 * Perform bulk operations on bills (update or delete)
 * Requires admin role
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5
 */
export const POST = auditLog(
  { operationType: 'bill_bulk_update', entityType: 'bill' },
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
      const validation = await validateRequestBody(body, schemas.bulkBillOperation);
      if (!validation.success) {
        return errors.badRequest(validation.error);
      }

      const { billIds, action, updates } = validation.data;

      let result;

      // Perform bulk operation
      if (action === 'update') {
        // Convert dueDate if provided
        const processedUpdates = { ...updates };
        if (processedUpdates?.dueDate) {
          (processedUpdates as any).dueDate = new Date(processedUpdates.dueDate);
        }

        result = await adminBillService.bulkUpdateBills(
          billIds,
          processedUpdates! as any,
          authResult.user.id
        );
      } else {
        result = await adminBillService.bulkDeleteBills(
          billIds,
          authResult.user.id
        );
      }

      return NextResponse.json({
        success: true,
        results: result.results,
        summary: {
          total: result.results.length,
          successful: result.results.filter(r => r.success).length,
          failed: result.results.filter(r => !r.success).length
        }
      });
    } catch (error) {
      return handleError(error);
    }
  }
);