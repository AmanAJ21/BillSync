import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import PaymentCycle from '@/lib/models/PaymentCycle';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * GET /api/payment-cycles/current
 * Display current cycle configuration and status for the authenticated user
 * Validates: Requirement 7.2
 */
export async function GET(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    // Authenticate user
    const auth = authenticateRequest(request);
    if (auth.error) {
      return auth.error;
    }

    // Find the active payment cycle for the user
    const currentCycle = await PaymentCycle.findOne({
      userId: auth.userId,
      status: 'active',
    });

    // If no active cycle exists, return 404
    if (!currentCycle) {
      return NextResponse.json(
        { error: 'No active payment cycle found' },
        { status: 404 }
      );
    }

    // Format response
    const response = {
      id: currentCycle._id.toString(),
      userId: currentCycle.userId,
      startDate: currentCycle.startDate.toISOString(),
      endDate: currentCycle.endDate.toISOString(),
      status: currentCycle.status,
      isActive: currentCycle.status === 'active',
      createdAt: currentCycle.createdAt.toISOString(),
      updatedAt: currentCycle.updatedAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error({ error }, 'Error in get current payment cycle endpoint');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to get current payment cycle';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
