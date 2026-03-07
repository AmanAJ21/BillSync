import { Job } from 'bull';
import { autoPaymentQueue } from '../queue';
import { autoPaymentService } from '../services/AutoPaymentService';
import logger from '../logger';

/**
 * Automatic Payment Processor Job
 * Processes scheduled payments for bills due within 24 hours
 * Validates: Requirements 2.1, 2.2
 * 
 * Schedule: Runs every 6 hours
 */

export interface AutoPaymentJobData {
  timestamp: Date;
}

/**
 * Process automatic payments job handler
 * Calls AutoPaymentService.processScheduledPaymentsWithExecution()
 */
export async function processAutoPayments(job: Job<AutoPaymentJobData>) {
  const { timestamp } = job.data;
  
  logger.info(
    { jobId: job.id, timestamp },
    'Starting automatic payment processor job'
  );

  try {
    // Process scheduled payments with execution
    const results = await autoPaymentService.processScheduledPaymentsWithExecution();

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    logger.info(
      {
        jobId: job.id,
        totalProcessed: results.length,
        successCount,
        failedCount,
        skippedCount,
        errorCount,
      },
      'Automatic payment processor job completed'
    );

    return {
      success: true,
      totalProcessed: results.length,
      successCount,
      failedCount,
      skippedCount,
      errorCount,
      results,
    };
  } catch (error) {
    logger.error(
      { error, jobId: job.id },
      'Error in automatic payment processor job'
    );
    throw error;
  }
}

/**
 * Register the automatic payment processor job
 * Sets up the job processor and schedules it to run every 6 hours
 */
export function registerAutoPaymentProcessor() {
  // Register job processor
  autoPaymentQueue.process('process-payments', processAutoPayments);

  // Schedule job to run every 6 hours
  // Cron expression: "0 */6 * * *" means at minute 0 of every 6th hour
  autoPaymentQueue.add(
    'process-payments',
    { timestamp: new Date() },
    {
      repeat: {
        cron: '0 */6 * * *', // Every 6 hours
      },
      jobId: 'auto-payment-processor', // Use fixed job ID to prevent duplicates
    }
  );

  logger.info('Registered automatic payment processor job (runs every 6 hours)');
}

export default {
  processAutoPayments,
  registerAutoPaymentProcessor,
};
