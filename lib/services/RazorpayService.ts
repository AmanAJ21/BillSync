import Razorpay from 'razorpay';
import crypto from 'crypto';
import logger from '@/lib/logger';

/**
 * RazorpayService
 * Handles Razorpay payment gateway integration
 * Validates: Requirements 6.3
 */

// Lazy initialization of Razorpay client
let razorpayClient: Razorpay | null = null;

function getRazorpayClient(): Razorpay {
  if (!razorpayClient) {
    const keyId = process.env.RAZORPAY_KEY_ID || 'test_key_id';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'test_key_secret';
    
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayClient;
}

export interface RazorpayOrderOptions {
  amount: number; // Amount in rupees (will be converted to paise)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment: {
      entity: {
        id: string;
        entity: string;
        amount: number;
        currency: string;
        status: string;
        order_id: string;
        invoice_id: string | null;
        international: boolean;
        method: string;
        amount_refunded: number;
        refund_status: string | null;
        captured: boolean;
        description: string;
        card_id: string | null;
        bank: string | null;
        wallet: string | null;
        vpa: string | null;
        email: string;
        contact: string;
        notes: Record<string, string>;
        fee: number;
        tax: number;
        error_code: string | null;
        error_description: string | null;
        error_source: string | null;
        error_step: string | null;
        error_reason: string | null;
        created_at: number;
      };
    };
  };
}

/**
 * Create a Razorpay order for payment
 * @param options Order creation options
 * @returns Razorpay order object
 */
export async function createRazorpayOrder(
  options: RazorpayOrderOptions
): Promise<RazorpayOrder> {
  try {
    // Convert amount from rupees to paise (Razorpay expects amount in smallest currency unit)
    const amountInPaise = Math.round(options.amount * 100);

    const orderOptions = {
      amount: amountInPaise,
      currency: options.currency || 'INR',
      receipt: options.receipt || `receipt_${Date.now()}`,
      notes: options.notes || {},
    };

    logger.info('Creating Razorpay order', { orderOptions });

    const client = getRazorpayClient();
    
    // Check if credentials are configured
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!keyId || !keySecret || keyId === 'test_key_id' || keySecret === 'test_key_secret') {
      logger.error('Razorpay credentials not configured properly');
      throw new Error('Payment gateway not configured. Please contact support.');
    }
    
    const order = await client.orders.create(orderOptions);

    logger.info('Razorpay order created successfully', { orderId: order.id });

    return order as RazorpayOrder;
  } catch (error) {
    logger.error('Failed to create Razorpay order', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      errorName: error instanceof Error ? error.name : undefined,
      errorDetails: error,
      stack: error instanceof Error ? error.stack : undefined,
      options 
    });
    
    // Log the full error object for debugging
    console.error('Full Razorpay error:', error);
    
    // Provide more specific error message
    if (error instanceof Error) {
      if (error.message.includes('authentication') || error.message.includes('Authentication')) {
        throw new Error('Payment gateway authentication failed. Please check credentials.');
      }
      if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
        throw new Error('Network error connecting to payment gateway. Please try again.');
      }
      // Pass through the actual error message for debugging
      throw new Error(`Payment gateway error: ${error.message}`);
    }
    
    throw new Error('Failed to create payment order. Please try again or contact support.');
  }
}

/**
 * Verify Razorpay payment signature
 * @param orderId Razorpay order ID
 * @param paymentId Razorpay payment ID
 * @param signature Razorpay signature
 * @returns True if signature is valid
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = generatedSignature === signature;

    if (isValid) {
      logger.info('Razorpay signature verified successfully', { orderId, paymentId });
    } else {
      logger.warn('Razorpay signature verification failed', { orderId, paymentId });
    }

    return isValid;
  } catch (error) {
    logger.error('Error verifying Razorpay signature', { error, orderId, paymentId });
    return false;
  }
}

/**
 * Verify Razorpay webhook signature
 * @param webhookBody Raw webhook body
 * @param webhookSignature Signature from X-Razorpay-Signature header
 * @param webhookSecret Webhook secret from Razorpay dashboard
 * @returns True if webhook signature is valid
 */
export function verifyWebhookSignature(
  webhookBody: string,
  webhookSignature: string,
  webhookSecret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookBody)
      .digest('hex');

    const isValid = expectedSignature === webhookSignature;

    if (isValid) {
      logger.info('Razorpay webhook signature verified successfully');
    } else {
      logger.warn('Razorpay webhook signature verification failed');
    }

    return isValid;
  } catch (error) {
    logger.error('Error verifying Razorpay webhook signature', { error });
    return false;
  }
}

/**
 * Fetch payment details from Razorpay
 * @param paymentId Razorpay payment ID
 * @returns Payment details
 */
export async function fetchPaymentDetails(paymentId: string) {
  try {
    logger.info('Fetching payment details from Razorpay', { paymentId });
    const client = getRazorpayClient();
    const payment = await client.payments.fetch(paymentId);
    logger.info('Payment details fetched successfully', { paymentId });
    return payment;
  } catch (error) {
    logger.error('Failed to fetch payment details', { error, paymentId });
    throw new Error('Failed to fetch payment details');
  }
}

export default {
  createRazorpayOrder,
  verifyRazorpaySignature,
  verifyWebhookSignature,
  fetchPaymentDetails,
};
