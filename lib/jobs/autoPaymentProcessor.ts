import { autoPaymentService } from '../services/AutoPaymentService';
import logger from '../logger';

/**
 * Automatic Payment Processor
 * Processes scheduled payments for bills due within 24 hours
 * Validates: Requirements 2.1, 2.2
 */

export interface AutoPaymentData {
  timestamp: Date;
}

/**
 * Process automatic payments handler
 * Calls AutoPaymentService.processScheduledPaymentsWithExecution()
 */
export async function processAutoPayments(data: AutoPaymentData = { timestamp: new Date() }) {
  const { timestamp } = data;

  logger.info(
    { timestamp },
    'Starting automatic payment processor'
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
        totalProcessed: results.length,
        successCount,
        failedCount,
        skippedCount,
        errorCount,
      },
      'Automatic payment processor completed'
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
      { error },
      'Error in automatic payment processor'
    );
    throw error;
  }
}

export default {
  processAutoPayments,
};
