import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import { verifyRazorpaySignature } from '@/lib/services/RazorpayService';
import { handlePaymentSuccess } from '@/lib/services/ConsolidatedBillPaymentService';
import logger from '@/lib/logger';
import { validateInternalRequest } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * POST /api/payments/verify
 * Verify Razorpay payment signature and update bill status
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

    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment details' },
        { status: 400 }
      );
    }

    logger.info('Verifying payment', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      userId: auth.userId,
    });

    // Verify signature
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      logger.error('Invalid payment signature', {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
      return NextResponse.json(
        { error: 'Invalid payment signature' },
        { status: 400 }
      );
    }

    // Handle successful payment
    await handlePaymentSuccess(razorpay_order_id, razorpay_payment_id);

    logger.info('Payment verified and processed successfully', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
    });
  } catch (error) {
    logger.error('Error verifying payment', { error });

    const errorMessage = error instanceof Error ? error.message : 'Failed to verify payment';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
