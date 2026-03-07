import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import { payConsolidatedBill } from '@/lib/services/ConsolidatedBillPaymentService';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

/**
 * POST /api/consolidated-bills/[id]/pay
 * Initiate payment for a consolidated bill
 * Validates: Requirements 6.1, 6.2, 6.3
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

    const userId = auth.userId;
    const { id: consolidatedBillId } = await context.params;

    logger.info('Payment initiation request received', { userId, consolidatedBillId });

    // Initiate payment
    const paymentOrder = await payConsolidatedBill(userId, consolidatedBillId);

    return NextResponse.json({
      success: true,
      data: paymentOrder,
      message: 'Payment order created successfully',
    });
  } catch (error) {
    logger.error('Error initiating payment', { error });

    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate payment';
    const statusCode = errorMessage.includes('not found') ? 404 : 
                       errorMessage.includes('Unauthorized') ? 403 :
                       errorMessage.includes('already paid') ? 400 : 500;

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
