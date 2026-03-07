import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import { autoPaymentService } from '@/lib/services/AutoPaymentService';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * POST /api/auto-payment/disable
 * Disable automatic payment for a bill
 * Validates: Requirement 1.3
 */
export async function POST(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    // Authenticate user
    const auth = authenticateRequest(request);
    if (auth.error) {
      return auth.error;
    }

    // Parse request body
    const body = await request.json();
    const { billId, reason } = body;

    // Validate required fields
    if (!billId) {
      return NextResponse.json(
        { error: 'billId is required' },
        { status: 400 }
      );
    }

    // Disable automatic payment
    const config = await autoPaymentService.disableAutomaticPayment(
      auth.userId,
      billId,
      reason
    );

    logger.info({ userId: auth.userId, billId, reason }, 'Auto-payment disabled via API');

    return NextResponse.json({
      success: true,
      config: {
        id: config._id.toString(),
        userId: config.userId,
        billId: config.billId,
        enabled: config.enabled,
        disabledReason: config.disabledReason,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error in disable auto-payment endpoint');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to disable auto-payment';
    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
