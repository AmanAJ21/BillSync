import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import { autoPaymentService } from '@/lib/services/AutoPaymentService';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * GET /api/auto-payment/list
 * List all bills with auto-payment enabled for the authenticated user
 * Validates: Requirement 1.4
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

    // Get all auto-payment configs for user (both enabled and disabled)
    const configs = await autoPaymentService.listAllAutoPayments(auth.userId);

    // Format response
    const formattedConfigs = configs.map(config => ({
      id: config._id.toString(),
      userId: config.userId,
      billId: config.billId,
      enabled: config.enabled,
      disabledReason: config.disabledReason,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));

    return NextResponse.json({
      count: formattedConfigs.length,
      configs: formattedConfigs,
    });
  } catch (error) {
    logger.error({ error }, 'Error in list auto-payments endpoint');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to list auto-payments';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
