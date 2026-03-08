import { paymentCycleService } from '../services/PaymentCycleService';
import PaymentCycle from '../models/PaymentCycle';
import logger from '../logger';

/**
 * Payment Cycle Manager
 * Manages payment cycle transitions by closing previous cycles and initializing new ones
 * Validates: Requirements 7.3, 7.4
 */

export interface PaymentCycleData {
  timestamp: Date;
}

/**
 * Manage payment cycles handler
 * Closes all active payment cycles that have ended and initializes new cycles
 */
export async function managePaymentCycles(data: PaymentCycleData = { timestamp: new Date() }) {
  const { timestamp } = data;

  logger.info(
    { timestamp },
    'Starting payment cycle manager'
  );

  try {
    // Find all active payment cycles that have ended
    const now = new Date();

    const activeCycles = await PaymentCycle.find({
      status: 'active',
      endDate: { $lt: now },
    });

    logger.info(
      { cycleCount: activeCycles.length },
      `Found ${activeCycles.length} active payment cycles that have ended`
    );

    const results: Array<{
      userId: string;
      oldCycleId: string;
      newCycleId?: string;
      status: 'success' | 'error';
      reason?: string;
    }> = [];

    // Close each cycle and initialize new one
    for (const cycle of activeCycles) {
      try {
        const { closedCycle, newCycle } = await paymentCycleService.closePaymentCycle(
          cycle._id.toString()
        );

        results.push({
          userId: cycle.userId,
          oldCycleId: closedCycle._id.toString(),
          newCycleId: newCycle._id.toString(),
          status: 'success',
        });

        logger.info(
          {
            userId: cycle.userId,
            oldCycleId: closedCycle._id.toString(),
            newCycleId: newCycle._id.toString(),
          },
          'Closed payment cycle and initialized new cycle'
        );
      } catch (error) {
        logger.error(
          { error, userId: cycle.userId, cycleId: cycle._id.toString() },
          'Error managing payment cycle'
        );
        results.push({
          userId: cycle.userId,
          oldCycleId: cycle._id.toString(),
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    logger.info(
      {
        totalProcessed: results.length,
        successCount,
        errorCount,
      },
      'Payment cycle manager completed'
    );

    return {
      success: true,
      totalProcessed: results.length,
      successCount,
      errorCount,
      results,
    };
  } catch (error) {
    logger.error(
      { error },
      'Error in payment cycle manager'
    );
    throw error;
  }
}

export default {
  managePaymentCycles,
};
