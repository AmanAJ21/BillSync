import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/middleware/role';
import { auditLog } from '../../../../../lib/middleware/audit';
import { adminBillService } from '../../../../../lib/services/AdminBillService';
import { verifyAuth } from '../../../../../lib/middleware/auth';
import { handleError, errors } from '../../../../../lib/middleware/errorHandler';
import { validateRequestBody, schemas } from '../../../../../lib/middleware/validation';

/**
 * PUT /api/admin/bills/[billId]
 * Update an existing bill
 * Requires admin role
 * Validates: Requirements 4.2, 4.5
 */
export const PUT = auditLog(
  { operationType: 'bill_update', entityType: 'bill' },
  async (request: NextRequest, { params }: { params: Promise<{ billId: string }> }) => {
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

      const { billId } = await params;

      // Validate billId format
      if (!billId || !/^[a-f0-9]{24}$/.test(billId)) {
        return errors.badRequest('Invalid bill ID format');
      }

      // Parse request body
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errors.badRequest('Invalid JSON in request body');
      }

      // Validate with Zod schema
      const validation = await validateRequestBody(body, schemas.updateBill);
      if (!validation.success) {
        return errors.badRequest(validation.error);
      }

      const updates = { ...validation.data };

      // Convert dueDate string to Date if provided
      if (updates.dueDate) {
        (updates as any).dueDate = new Date(updates.dueDate);
      }

      // Update bill
      const updatedBill = await adminBillService.updateBill(
        billId,
        updates as any,
        authResult.user.id
      );

      if (!updatedBill) {
        return errors.notFound('Bill');
      }

      return NextResponse.json(
        { success: true, bill: updatedBill }
      );
    } catch (error) {
      return handleError(error);
    }
  }
);

/**
 * DELETE /api/admin/bills/[billId]
 * Delete a bill
 * Requires admin role
 * Validates: Requirements 4.3
 */
export const DELETE = auditLog(
  { operationType: 'bill_delete', entityType: 'bill' },
  async (request: NextRequest, { params }: { params: Promise<{ billId: string }> }) => {
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

      const { billId } = await params;

      // Validate billId format
      if (!billId || !/^[a-f0-9]{24}$/.test(billId)) {
        return errors.badRequest('Invalid bill ID format');
      }

      // Delete bill
      await adminBillService.deleteBill(billId, authResult.user.id);

      return NextResponse.json(
        { success: true }
      );
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return errors.notFound('Bill');
        }
      }

      return handleError(error);
    }
  }
);