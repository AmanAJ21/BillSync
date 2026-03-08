import { aggregationEngine } from '../services/AggregationEngine';
import { notificationService } from '../services/NotificationService';
import PaymentCycle from '../models/PaymentCycle';
import logger from '../logger';

/**
 * Consolidated Bill Generator
 * Generates consolidated bills for all users at the end of each payment cycle
 * Validates: Requirements 4.1, 5.1, 7.3
 */

export interface ConsolidatedBillData {
  timestamp: Date;
}

/**
 * Generate consolidated bills handler
 * Finds all active payment cycles and generates consolidated bills for each
 */
export async function generateConsolidatedBills(data: ConsolidatedBillData = { timestamp: new Date() }) {
  const { timestamp } = data;

  logger.info(
    { timestamp },
    'Starting consolidated bill generator'
  );

  try {
    // Find all active payment cycles that are ending today
    const today = new Date();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const activeCycles = await PaymentCycle.find({
      status: 'active',
      endDate: { $lte: endOfToday },
    });

    logger.info(
      { cycleCount: activeCycles.length },
      `Found ${activeCycles.length} payment cycles ending today`
    );

    const results: Array<{
      userId: string;
      paymentCycleId: string;
      status: 'success' | 'skipped' | 'error';
      consolidatedBillId?: string;
      reason?: string;
    }> = [];

    // Generate consolidated bill for each cycle
    for (const cycle of activeCycles) {
      try {
        const consolidatedBill = await aggregationEngine.generateConsolidatedBill(
          cycle.userId,
          cycle._id.toString()
        );

        if (consolidatedBill) {
          results.push({
            userId: cycle.userId,
            paymentCycleId: cycle._id.toString(),
            status: 'success',
            consolidatedBillId: consolidatedBill._id.toString(),
          });

          // Send notification to user about new consolidated bill
          // Validates: Requirement 5.1
          await notificationService.notifyConsolidatedBillGenerated(
            cycle.userId,
            consolidatedBill._id.toString(),
            consolidatedBill.totalAmount
          );

          logger.info(
            {
              userId: cycle.userId,
              paymentCycleId: cycle._id.toString(),
              consolidatedBillId: consolidatedBill._id.toString(),
            },
            'Generated consolidated bill and sent notification to user'
          );
        } else {
          results.push({
            userId: cycle.userId,
            paymentCycleId: cycle._id.toString(),
            status: 'skipped',
            reason: 'No auto-payment records in cycle',
          });
        }
      } catch (error) {
        logger.error(
          { error, userId: cycle.userId, paymentCycleId: cycle._id.toString() },
          'Error generating consolidated bill for cycle'
        );
        results.push({
          userId: cycle.userId,
          paymentCycleId: cycle._id.toString(),
          status: 'error',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    logger.info(
      {
        totalProcessed: results.length,
        successCount,
        skippedCount,
        errorCount,
      },
      'Consolidated bill generator completed'
    );

    return {
      success: true,
      totalProcessed: results.length,
      successCount,
      skippedCount,
      errorCount,
      results,
    };
  } catch (error) {
    logger.error(
      { error },
      'Error in consolidated bill generator'
    );
    throw error;
  }
}

export default {
  generateConsolidatedBills,
};
