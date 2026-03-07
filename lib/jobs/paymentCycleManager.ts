import { Job } from 'bull';
import { paymentCycleQueue } from '../queue';
import { paymentCycleService } from '../services/PaymentCycleService';
import PaymentCycle from '../models/PaymentCycle';
import logger from '../logger';

/**
 * Payment Cycle Manager Job
 * Manages payment cycle transitions by closing previous cycles and initializing new ones
 * Validates: Requirements 7.3, 7.4
 * 
 * Schedule: Runs on first day of each month at 12:00 AM
 */

export interface PaymentCycleJobData {
  timestamp: Date;
}

/**
 * Manage payment cycles job handler
 * Closes all active payment cycles that have ended and initializes new cycles
 */
export async function managePaymentCycles(job: Job<PaymentCycleJobData>) {
  const { timestamp } = job.data;
  
  logger.info(
    { jobId: job.id, timestamp },
    'Starting payment cycle manager job'
  );

  try {
    // Find all active payment cycles that have ended
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const activeCycles = await PaymentCycle.find({
      status: 'active',
      endDate: { $lt: now },
    });

    logger.info(
      { jobId: job.id, cycleCount: activeCycles.length },
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
        jobId: job.id,
        totalProcessed: results.length,
        successCount,
        errorCount,
      },
      'Payment cycle manager job completed'
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
      { error, jobId: job.id },
      'Error in payment cycle manager job'
    );
    throw error;
  }
}

/**
 * Register the payment cycle manager job
 * Sets up the job processor and schedules it to run on first day of month at 12:00 AM
 */
export function registerPaymentCycleManager() {
  // Register job processor
  paymentCycleQueue.process('manage-cycles', managePaymentCycles);

  // Schedule job to run on first day of month at 12:00 AM
  // Cron expression: "0 0 1 * *" means at 00:00 on day 1 of every month
  paymentCycleQueue.add(
    'manage-cycles',
    { timestamp: new Date() },
    {
      repeat: {
        cron: '0 0 1 * *', // First day of month at midnight
      },
      jobId: 'payment-cycle-manager', // Use fixed job ID to prevent duplicates
    }
  );

  logger.info('Registered payment cycle manager job (runs on first day of month at 12:00 AM)');
}

export default {
  managePaymentCycles,
  registerPaymentCycleManager,
};
