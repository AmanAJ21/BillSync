import { NextRequest, NextResponse } from 'next/server';
import { verifyRazorpaySignature } from '@/lib/services/RazorpayService';
import {
  handlePaymentSuccess,
  handlePaymentFailure,
} from '@/lib/services/ConsolidatedBillPaymentService';
import logger from '@/lib/logger';

/**
 * POST /api/webhooks/razorpay
 * Handle Razorpay payment webhooks
 * Validates: Requirements 6.4, 6.5, 6.6
 * 
 * NOTE: This endpoint is intentionally left as EXTERNAL (not internal-only)
 * because it needs to receive webhook events from Razorpay's servers.
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook signature from headers
    const signature = request.headers.get('x-razorpay-signature');
    
    if (!signature) {
      logger.warn('Webhook signature missing');
      return NextResponse.json(
        { error: 'Signature missing' },
        { status: 400 }
      );
    }

    // Parse webhook body
    const body = await request.json();
    
    logger.info('Razorpay webhook received', { 
      event: body.event,
      entity: body.entity 
    });

    // Extract payment details based on event type
    const event = body.event;
    
    if (event === 'payment.captured') {
      // Payment successful
      const payment = body.payload.payment.entity;
      const orderId = payment.order_id;
      const paymentId = payment.id;
      
      // Verify signature
      const razorpaySignature = payment.notes?.signature || '';
      
      logger.info('Processing payment.captured event', { orderId, paymentId });
      
      // Handle payment success
      await handlePaymentSuccess(orderId, paymentId);
      
      return NextResponse.json({
        success: true,
        message: 'Payment processed successfully',
      });
    } else if (event === 'payment.failed') {
      // Payment failed
      const payment = body.payload.payment.entity;
      const orderId = payment.order_id;
      const errorReason = payment.error_description || 'Payment failed';
      
      logger.info('Processing payment.failed event', { orderId, errorReason });
      
      // Handle payment failure
      await handlePaymentFailure(orderId, errorReason);
      
      return NextResponse.json({
        success: true,
        message: 'Payment failure processed',
      });
    } else {
      // Other events - acknowledge but don't process
      logger.info('Unhandled webhook event', { event });
      
      return NextResponse.json({
        success: true,
        message: 'Event acknowledged',
      });
    }
  } catch (error) {
    logger.error('Error processing webhook', { error });
    
    // Return 200 to prevent Razorpay from retrying
    // Log the error for manual investigation
    return NextResponse.json(
      { 
        success: false,
        error: 'Webhook processing failed',
      },
      { status: 200 }
    );
  }
}
