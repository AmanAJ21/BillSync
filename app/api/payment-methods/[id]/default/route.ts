import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/middleware/auth';
import { paymentMethodService } from '@/lib/services/PaymentMethodService';
import { handleError, errors } from '@/lib/middleware/errorHandler';

/**
 * PATCH /api/payment-methods/[id]/default
 * Set a payment method as default
 * Requires authentication
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return errors.unauthorized('Authentication required');
    }

    const userId = authResult.user.id;
    const { id } = await params;

    // Validate ID
    if (!id || id.length !== 24) {
      return errors.badRequest('Invalid payment method ID');
    }

    // Set as default
    const paymentMethod = await paymentMethodService.setDefaultPaymentMethod(userId, id);

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
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return errors.notFound('Payment method');
      }
      if (error.message.includes('expired')) {
        return errors.badRequest('Cannot set expired payment method as default');
      }
    }
    return handleError(error);
  }
}
