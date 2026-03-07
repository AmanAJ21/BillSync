import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { autoPaymentService } from '@/lib/services/AutoPaymentService';
import logger from '@/lib/logger';
import { validateInternalRequest } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * POST /api/admin/auto-payment/trigger
 * Manually trigger auto-payment processing for all users
 * Admin only - processes all bills with auto-payment enabled
 */
export async function POST(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    // Authenticate and verify admin
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user role from database
    const db = await getDatabase();
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(authResult.user.id) });

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    logger.info(
      { adminId: authResult.user.id },
      'Admin manually triggering auto-payment processing'
    );

    // Process all scheduled payments
    const results = await autoPaymentService.processScheduledPaymentsWithExecution();

    // Categorize results
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    const skipped = results.filter(r => r.status === 'skipped');
    const errors = results.filter(r => r.status === 'error');

    logger.info(
      {
        adminId: authResult.user.id,
        totalProcessed: results.length,
        successful: successful.length,
        failed: failed.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      'Auto-payment processing completed'
    );

    return NextResponse.json({
      success: true,
      message: 'Auto-payment processing completed',
      summary: {
        totalProcessed: results.length,
        successful: successful.length,
        failed: failed.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      results: results.map(r => ({
        billId: r.billId,
        userId: r.userId,
        status: r.status,
        reason: r.reason,
        transactionId: r.transactionId,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Error in admin auto-payment trigger endpoint');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to trigger auto-payment processing';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
