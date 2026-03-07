import ConsolidatedBill from '@/lib/models/ConsolidatedBill';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';
import { createRazorpayOrder } from '@/lib/services/RazorpayService';
import logger from '@/lib/logger';
import connectDB from '@/lib/mongoose';

/**
 * ConsolidatedBillPaymentService
 * Handles payment processing for consolidated bills
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  consolidatedBillId: string;
}

/**
 * Initiate payment for a consolidated bill
 * Creates a Razorpay order for the total amount
 * Validates: Requirements 6.1, 6.2, 6.3
 * 
 * @param userId User ID
 * @param consolidatedBillId Consolidated bill ID
 * @returns Payment order details
 */
export async function payConsolidatedBill(
  userId: string,
  consolidatedBillId: string
): Promise<PaymentOrderResponse> {
  try {
    await connectDB();

    logger.info('Initiating consolidated bill payment', { userId, consolidatedBillId });

    // Retrieve consolidated bill
    const consolidatedBill = await ConsolidatedBill.findById(consolidatedBillId);

    if (!consolidatedBill) {
      logger.error('Consolidated bill not found', { consolidatedBillId });
      throw new Error('Consolidated bill not found');
    }

    logger.info('Consolidated bill found', { 
      billId: consolidatedBill._id,
      userId: consolidatedBill.userId,
      totalAmount: consolidatedBill.totalAmount,
      status: consolidatedBill.status
    });

    // Verify ownership
    if (consolidatedBill.userId !== userId) {
      logger.error('Unauthorized access to consolidated bill', { userId, consolidatedBillId });
      throw new Error('Unauthorized access to consolidated bill');
    }

    // Check if already paid
    if (consolidatedBill.status === 'paid') {
      logger.warn('Consolidated bill already paid', { consolidatedBillId });
      throw new Error('Consolidated bill is already paid');
    }

    logger.info('Creating Razorpay order', {
      amount: consolidatedBill.totalAmount,
      receipt: `cb_${consolidatedBillId.toString().substring(0, 20)}`
    });

    // Create Razorpay order
    // Note: Razorpay receipt must be max 40 characters
    const razorpayOrder = await createRazorpayOrder({
      amount: consolidatedBill.totalAmount,
      receipt: `cb_${consolidatedBillId.toString().substring(0, 20)}`, // Max 40 chars
      notes: {
        userId,
        consolidatedBillId: consolidatedBillId.toString(),
        paymentCycleId: consolidatedBill.paymentCycleId,
      },
    });

    logger.info('Razorpay order created, updating bill', { orderId: razorpayOrder.id });

    // Update consolidated bill with Razorpay order ID
    consolidatedBill.razorpayOrderId = razorpayOrder.id;
    await consolidatedBill.save();

    logger.info('Payment order created successfully', {
      consolidatedBillId,
      orderId: razorpayOrder.id,
    });

    return {
      orderId: razorpayOrder.id,
      amount: consolidatedBill.totalAmount,
      currency: razorpayOrder.currency,
      consolidatedBillId: consolidatedBillId.toString(),
    };
  } catch (error) {
    logger.error('Failed to initiate consolidated bill payment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      userId,
      consolidatedBillId,
    });
    console.error('Full payment error:', error);
    throw error;
  }
}

/**
 * Handle successful payment
 * Updates consolidated bill status and marks all linked auto payment records as settled
 * Validates: Requirements 6.4, 6.5
 * 
 * @param razorpayOrderId Razorpay order ID
 * @param razorpayPaymentId Razorpay payment ID
 */
export async function handlePaymentSuccess(
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<void> {
  try {
    await connectDB();

    logger.info('Handling payment success', { razorpayOrderId, razorpayPaymentId });

    // Find consolidated bill by Razorpay order ID
    const consolidatedBill = await ConsolidatedBill.findOne({ razorpayOrderId });

    if (!consolidatedBill) {
      logger.error('Consolidated bill not found for order', { razorpayOrderId });
      throw new Error('Consolidated bill not found');
    }

    // Update consolidated bill status to paid
    consolidatedBill.status = 'paid';
    consolidatedBill.paidAt = new Date();
    await consolidatedBill.save();

    logger.info('Consolidated bill marked as paid', {
      consolidatedBillId: consolidatedBill._id,
      razorpayOrderId,
    });

    // Mark all linked auto payment records as settled
    const autoPaymentRecordIds = consolidatedBill.autoPaymentRecords;
    
    const updateResult = await AutoPaymentRecord.updateMany(
      { _id: { $in: autoPaymentRecordIds } },
      { $set: { status: 'settled' } }
    );

    logger.info('Auto payment records marked as settled', {
      consolidatedBillId: consolidatedBill._id,
      recordsUpdated: updateResult.modifiedCount,
      totalRecords: autoPaymentRecordIds.length,
    });

    // Verify all records were updated
    if (updateResult.modifiedCount !== autoPaymentRecordIds.length) {
      logger.warn('Not all auto payment records were updated', {
        expected: autoPaymentRecordIds.length,
        actual: updateResult.modifiedCount,
      });
    }
  } catch (error) {
    logger.error('Failed to handle payment success', {
      error,
      razorpayOrderId,
      razorpayPaymentId,
    });
    throw error;
  }
}

/**
 * Handle failed payment
 * Keeps consolidated bill status as pending to allow retry
 * Validates: Requirement 6.6
 * 
 * @param razorpayOrderId Razorpay order ID
 * @param errorReason Error reason
 */
export async function handlePaymentFailure(
  razorpayOrderId: string,
  errorReason?: string
): Promise<void> {
  try {
    await connectDB();

    logger.info('Handling payment failure', { razorpayOrderId, errorReason });

    // Find consolidated bill by Razorpay order ID
    const consolidatedBill = await ConsolidatedBill.findOne({ razorpayOrderId });

    if (!consolidatedBill) {
      logger.error('Consolidated bill not found for order', { razorpayOrderId });
      throw new Error('Consolidated bill not found');
    }

    // Keep status as pending to allow retry
    // Only mark as failed if explicitly needed
    consolidatedBill.status = 'pending';
    await consolidatedBill.save();

    logger.info('Consolidated bill kept as pending for retry', {
      consolidatedBillId: consolidatedBill._id,
      razorpayOrderId,
      errorReason,
    });
  } catch (error) {
    logger.error('Failed to handle payment failure', {
      error,
      razorpayOrderId,
      errorReason,
    });
    throw error;
  }
}

export default {
  payConsolidatedBill,
  handlePaymentSuccess,
  handlePaymentFailure,
};
