import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/middleware/role';
import { exportService } from '../../../../../lib/services/ExportService';
import { verifyAuth } from '../../../../../lib/middleware/auth';
import { handleError, errors } from '../../../../../lib/middleware/errorHandler';

/**
 * POST /api/admin/export/bills
 * Export bills data to CSV format
 * Requires admin role
 * Validates: Requirements 13.2, 13.3, 13.4, 13.5
 */
export async function POST(request: NextRequest) {
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

    // Parse request body for filters
    let body: any;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const { filters = {} } = body;

    // Validate filter values if provided
    if (filters.status && !['pending', 'paid', 'overdue'].includes(filters.status)) {
      return errors.badRequest('Invalid status filter. Must be "pending", "paid", or "overdue"');
    }

    if (filters.userId && typeof filters.userId !== 'string') {
      return errors.badRequest('Invalid userId filter. Must be a string');
    }

    if (filters.startDate && isNaN(Date.parse(filters.startDate))) {
      return errors.badRequest('Invalid startDate format. Use ISO 8601 format');
    }

    if (filters.endDate && isNaN(Date.parse(filters.endDate))) {
      return errors.badRequest('Invalid endDate format. Use ISO 8601 format');
    }

    // Convert date strings to Date objects
    const processedFilters = {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    };

    // Generate CSV export
    const csvData = await exportService.exportBills(
      processedFilters,
      authResult.user.id
    );

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `bills-export-${timestamp}.csv`;

    // Return CSV file as download
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return handleError(error);
  }
}