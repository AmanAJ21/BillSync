import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import { autoPaymentService } from '@/lib/services/AutoPaymentService';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * GET /api/auto-payment/status/[billId]
 * Get auto-payment status for a specific bill
 * Validates: Requirement 1.4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    // Authenticate user
    const auth = authenticateRequest(request);
    if (auth.error) {
      return auth.error;
    }

    const { billId } = await params;

    // Validate billId
    if (!billId) {
      return NextResponse.json(
        { error: 'billId is required' },
        { status: 400 }
      );
    }

    // Get auto-payment status
    const config = await autoPaymentService.getAutoPaymentStatus(
      auth.userId,
      billId
    );

    if (!config) {
      return NextResponse.json({
        enabled: false,
        message: 'Auto-payment not configured for this bill',
      });
    }

    return NextResponse.json({
      enabled: config.enabled,
      config: {
        id: config._id.toString(),
        userId: config.userId,
        billId: config.billId,
        enabled: config.enabled,
        disabledReason: config.disabledReason,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error in get auto-payment status endpoint');

    const errorMessage = error instanceof Error ? error.message : 'Failed to get auto-payment status';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
