import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import { analyticsService } from '@/lib/services/AnalyticsService';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * GET /api/analytics/auto-payments
 * Get comprehensive auto-payment analytics for the authenticated user
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
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

    // Get analytics for user
    const analytics = await analyticsService.getAutoPaymentAnalytics(auth.userId);

    return NextResponse.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error({ error }, 'Error in auto-payment analytics endpoint');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve analytics';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
