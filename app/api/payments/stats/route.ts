import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/middleware/auth';
import { manualPaymentService } from '@/lib/services/ManualPaymentService';
import { handleError, errors } from '@/lib/middleware/errorHandler';

/**
 * GET /api/payments/stats
 * Get payment statistics for the authenticated user
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return errors.unauthorized('Authentication required');
    }

    const userId = authResult.user.id;

    // Get payment statistics
    const stats = await manualPaymentService.getUserPaymentStats(userId);

    return NextResponse.json({
      stats,
    });
  } catch (error) {
    return handleError(error);
  }
}
