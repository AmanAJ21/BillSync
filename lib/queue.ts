import Bull from 'bull';
import logger from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Queue for automatic payment processing
export const autoPaymentQueue = new Bull('auto-payment', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Queue for consolidated bill generation
export const consolidatedBillQueue = new Bull('consolidated-bill', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Queue for payment cycle management
export const paymentCycleQueue = new Bull('payment-cycle', REDIS_URL, {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Event listeners for monitoring
autoPaymentQueue.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Auto payment job completed');
});

autoPaymentQueue.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Auto payment job failed');
});

consolidatedBillQueue.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Consolidated bill job completed');
});

consolidatedBillQueue.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Consolidated bill job failed');
});

paymentCycleQueue.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Payment cycle job completed');
});

paymentCycleQueue.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Payment cycle job failed');
});

export default {
  autoPaymentQueue,
  consolidatedBillQueue,
  paymentCycleQueue,
};
