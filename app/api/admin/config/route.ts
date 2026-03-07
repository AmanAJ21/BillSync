import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/middleware/role';
import { systemConfigService } from '../../../../lib/services/SystemConfigService';
import { handleError, errors } from '../../../../lib/middleware/errorHandler';

/**
 * GET /api/admin/config
 * Get system configurations with optional category filtering
 * Requires admin role
 * Validates: Requirements 10.1, 10.5
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
    const category = searchParams.get('category') as 'payment' | 'notification' | 'auto_payment' | 'general' | null;

    // Validate category parameter if provided
    if (category && !['payment', 'notification', 'auto_payment', 'general'].includes(category)) {
      return errors.badRequest(
        'Invalid category. Must be one of: payment, notification, auto_payment, general'
      );
    }

    // Get configurations with optional filtering
    const configs = await systemConfigService.getAllConfigs(
      category ? { category } : {}
    );

    return NextResponse.json({ configs });
  } catch (error) {
    return handleError(error);
  }
}