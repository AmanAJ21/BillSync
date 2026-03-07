import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import { autoPaymentService } from '@/lib/services/AutoPaymentService';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * POST /api/auto-payment/enable
 * Enable automatic payment for a bill
 * Validates: Requirements 1.1, 1.2, 1.5
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
    const { billId } = body;

    // Validate required fields
    if (!billId) {
      return NextResponse.json(
        { error: 'billId is required' },
        { status: 400 }
      );
    }

    // Enable automatic payment
    const config = await autoPaymentService.enableAutomaticPayment(
      auth.userId,
      billId
    );

    logger.info({ userId: auth.userId, billId }, 'Auto-payment enabled via API');

    // Check if payment method was auto-created
    const { getEnvCardDetails } = await import('@/lib/utils/default-payment-method');
    const envCardDetails = getEnvCardDetails();

    return NextResponse.json({
      success: true,
      config: {
        id: config._id.toString(),
        userId: config.userId,
        billId: config.billId,
        enabled: config.enabled,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
      paymentMethod: envCardDetails ? {
        source: 'environment',
        cardLast4: envCardDetails.cardLast4,
        cardBrand: envCardDetails.cardBrand,
        expiryMonth: envCardDetails.expiryMonth,
        expiryYear: envCardDetails.expiryYear,
        message: 'Using default payment method from environment configuration'
      } : undefined,
    });
  } catch (error) {
    logger.error({ 
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    }, 'Error in enable auto-payment endpoint');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to enable auto-payment';
    
    // Provide specific error codes and helpful messages
    let statusCode = 500;
    let errorResponse: any = { error: errorMessage };
    
    if (errorMessage.includes('No payment method found')) {
      statusCode = 400;
      errorResponse = {
        error: 'No payment method found',
        message: 'You need to add a payment method before enabling auto-payment',
        code: 'NO_PAYMENT_METHOD',
        action: 'Please add a payment method in your profile settings'
      };
    } else if (errorMessage.includes('Payment method has expired')) {
      statusCode = 400;
      errorResponse = {
        error: 'Payment method expired',
        message: 'Your payment method has expired. Please update it to enable auto-payment',
        code: 'PAYMENT_METHOD_EXPIRED',
        action: 'Please update your payment method in your profile settings'
      };
    } else if (errorMessage.includes('Bill not found')) {
      statusCode = 404;
      errorResponse = {
        error: 'Bill not found',
        message: 'The specified bill does not exist',
        code: 'BILL_NOT_FOUND'
      };
    }
    
    return NextResponse.json(errorResponse, { status: statusCode });
  }
}
