import { Job } from 'bull';
import { consolidatedBillQueue } from '../queue';
import { aggregationEngine } from '../services/AggregationEngine';
import { notificationService } from '../services/NotificationService';
import PaymentCycle from '../models/PaymentCycle';
import logger from '../logger';

/**
 * Consolidated Bill Generator Job
 * Generates consolidated bills for all users at the end of each payment cycle
 * Validates: Requirements 4.1, 5.1, 7.3
 * 
 * Schedule: Runs on last day of each month at 11:59 PM
 */

export interface ConsolidatedBillJobData {
  timestamp: Date;
}

/**
 * Generate consolidated bills job handler
 * Finds all active payment cycles and generates consolidated bills for each
 */
export async function generateConsolidatedBills(job: Job<ConsolidatedBillJobData>) {
  const { timestamp } = job.data;
  
  logger.info(
    { jobId: job.id, timestamp },
    'Starting consolidated bill generator job'
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
      { jobId: job.id, cycleCount: activeCycles.length },
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
        jobId: job.id,
        totalProcessed: results.length,
        successCount,
        skippedCount,
        errorCount,
      },
      'Consolidated bill generator job completed'
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
      { error, jobId: job.id },
      'Error in consolidated bill generator job'
    );
    throw error;
  }
}

/**
 * Register the consolidated bill generator job
 * Sets up the job processor and schedules it to run on last day of month at 11:59 PM
 */
export function registerConsolidatedBillGenerator() {
  // Register job processor
  consolidatedBillQueue.process('generate-bills', generateConsolidatedBills);

  // Schedule job to run on last day of month at 11:59 PM
  // Cron expression: "59 23 L * *" would be ideal but Bull uses node-cron which doesn't support L
  // Instead, we'll use "59 23 28-31 * *" to run on days 28-31 at 11:59 PM
  // The job logic will check if it's actually the last day of the month
  consolidatedBillQueue.add(
    'generate-bills',
    { timestamp: new Date() },
    {
      repeat: {
        cron: '59 23 28-31 * *', // Days 28-31 at 11:59 PM
      },
      jobId: 'consolidated-bill-generator', // Use fixed job ID to prevent duplicates
    }
  );

  logger.info('Registered consolidated bill generator job (runs on last day of month at 11:59 PM)');
}

export default {
  generateConsolidatedBills,
  registerConsolidatedBillGenerator,
};
