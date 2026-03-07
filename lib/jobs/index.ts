import { registerAutoPaymentProcessor } from './autoPaymentProcessor';
import { registerConsolidatedBillGenerator } from './consolidatedBillGenerator';
import { registerPaymentCycleManager } from './paymentCycleManager';
import logger from '../logger';

/**
 * Register all background jobs
 * This function should be called once when the application starts
 * to set up all scheduled background jobs
 */
export function registerAllJobs() {
  try {
    logger.info('Registering all background jobs...');

    // Register automatic payment processor (runs every 6 hours)
    registerAutoPaymentProcessor();

    // Register consolidated bill generator (runs on last day of month at 11:59 PM)
    registerConsolidatedBillGenerator();

    // Register payment cycle manager (runs on first day of month at 12:00 AM)
    registerPaymentCycleManager();

    logger.info('All background jobs registered successfully');
  } catch (error) {
    logger.error({ error }, 'Error registering background jobs');
    throw error;
  }
}

// Export individual job modules
export * from './autoPaymentProcessor';
export * from './consolidatedBillGenerator';
export * from './paymentCycleManager';

export default {
  registerAllJobs,
};
