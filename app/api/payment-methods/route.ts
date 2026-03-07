import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/middleware/auth';
import { paymentMethodService } from '@/lib/services/PaymentMethodService';
import { handleError, errors } from '@/lib/middleware/errorHandler';
import { z } from 'zod';

// Validation schema for adding payment method
const addPaymentMethodSchema = z.object({
  type: z.enum(['card', 'bank_account', 'upi']),
  cardLast4: z.string().length(4).optional(),
  cardBrand: z.string().optional(),
  expiryMonth: z.number().min(1).max(12).optional(),
  expiryYear: z.number().min(new Date().getFullYear()).optional(),
  bankName: z.string().optional(),
  accountLast4: z.string().length(4).optional(),
  upiId: z.string().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * GET /api/payment-methods
 * Get all payment methods for the authenticated user
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return errors.unauthorized('Authentication required');
    }

    const userId = authResult.user.id;

    // Get payment methods
    const paymentMethods = await paymentMethodService.getUserPaymentMethods(userId);

    // Remove sensitive data
    const sanitizedMethods = paymentMethods.map(pm => ({
      _id: pm._id,
      type: pm.type,
      cardLast4: pm.cardLast4,
      cardBrand: pm.cardBrand,
      expiryMonth: pm.expiryMonth,
      expiryYear: pm.expiryYear,
      bankName: pm.bankName,
      accountLast4: pm.accountLast4,
      upiId: pm.upiId,
      isDefault: pm.isDefault,
      isExpired: pm.isExpired,
      createdAt: pm.createdAt,
      updatedAt: pm.updatedAt,
    }));

    return NextResponse.json({
      paymentMethods: sanitizedMethods,
    });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * POST /api/payment-methods
 * Add a new payment method for the authenticated user
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return errors.unauthorized('Authentication required');
    }

    const userId = authResult.user.id;

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON in request body');
    }

    // Validate with Zod
    const parseResult = addPaymentMethodSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.issues
        .map((err: any) => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      return errors.badRequest(errorMessages);
    }

    const data = parseResult.data;

    // Validate type-specific fields
    if (data.type === 'card') {
      if (!data.cardLast4 || !data.cardBrand || !data.expiryMonth || !data.expiryYear) {
        return errors.badRequest('Card payment method requires cardLast4, cardBrand, expiryMonth, and expiryYear');
      }
    } else if (data.type === 'upi') {
      if (!data.upiId) {
        return errors.badRequest('UPI payment method requires upiId');
      }
    } else if (data.type === 'bank_account') {
      if (!data.bankName || !data.accountLast4) {
        return errors.badRequest('Bank account payment method requires bankName and accountLast4');
      }
    }

    // Add payment method
    const paymentMethod = await paymentMethodService.addPaymentMethod(userId, data);

    // Remove sensitive data from response
    const sanitizedMethod = {
      _id: paymentMethod._id,
      type: paymentMethod.type,
      cardLast4: paymentMethod.cardLast4,
      cardBrand: paymentMethod.cardBrand,
      expiryMonth: paymentMethod.expiryMonth,
      expiryYear: paymentMethod.expiryYear,
      bankName: paymentMethod.bankName,
      accountLast4: paymentMethod.accountLast4,
      upiId: paymentMethod.upiId,
      isDefault: paymentMethod.isDefault,
      isExpired: paymentMethod.isExpired,
      createdAt: paymentMethod.createdAt,
      updatedAt: paymentMethod.updatedAt,
    };

    return NextResponse.json({
      success: true,
      paymentMethod: sanitizedMethod,
    });
  } catch (error) {
    return handleError(error);
  }
}
