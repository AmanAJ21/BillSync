import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import { analyticsService } from '@/lib/services/AnalyticsService';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * GET /api/analytics/payment-history
 * Get payment history across all cycles for the authenticated user
 * Validates: Requirements 8.5
 */
export async function GET(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    // Authenticate user
    const auth = authenticateRequest(request);
    if (auth.error) {
      return auth.error;
    }

    // Get limit from query params (default: 12)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12', 10);

    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Get payment history for user
    const history = await analyticsService.getPaymentHistory(auth.userId, limit);

    return NextResponse.json({
      success: true,
      data: {
        cycleCount: history.length,
        history,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error in payment history endpoint');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve payment history';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
