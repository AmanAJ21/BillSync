import PaymentCycle, { IPaymentCycle, PaymentCycleStatus } from '../models/PaymentCycle';
import logger from '../logger';

/**
 * PaymentCycleService
 * Manages payment cycle operations including initialization and closure
 * Validates: Requirements 7.1, 7.3, 7.4
 */
export class PaymentCycleService {
  /**
   * Initialize a new payment cycle for a user
   * Creates a monthly cycle with start date as first day of month and end date as last day of month
   * Ensures only one active cycle per user at a time
   * Validates: Requirements 7.1, 7.4
   * 
   * @param userId - The user ID
   * @returns The created PaymentCycle
   * @throws Error if user already has an active cycle or validation fails
   */
  async initializePaymentCycle(userId: string): Promise<IPaymentCycle> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Check if user already has an active cycle
      const existingActive = await PaymentCycle.findOne({
        userId,
        status: PaymentCycleStatus.ACTIVE,
      });

      if (existingActive) {
        throw new Error('User already has an active payment cycle');
      }

      // Get current date
      const now = new Date();
      
      // Set start date to first day of current month
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Set end date to last day of current month
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Create the payment cycle
      const paymentCycle = await PaymentCycle.create({
        userId,
        startDate,
        endDate,
        status: PaymentCycleStatus.ACTIVE,
      });

      logger.info(
        {
          userId,
          paymentCycleId: paymentCycle._id.toString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        'Initialized payment cycle'
      );

      return paymentCycle;
    } catch (error) {
      logger.error({ error, userId }, 'Error initializing payment cycle');
      throw error;
    }
  }

  /**
   * Close a payment cycle and initialize a new one for the next month
   * Updates cycle status to completed, triggers consolidated bill generation,
   * and creates a new cycle for the next month
   * Validates: Requirements 7.3, 7.4
   * 
   * @param paymentCycleId - The payment cycle ID to close
   * @returns Object containing the closed cycle and new cycle
   * @throws Error if cycle not found or already completed
   */
  async closePaymentCycle(paymentCycleId: string): Promise<{
    closedCycle: IPaymentCycle;
    newCycle: IPaymentCycle;
  }> {
    try {
      if (!paymentCycleId) {
        throw new Error('Payment cycle ID is required');
      }

      // Find the payment cycle
      const cycle = await PaymentCycle.findById(paymentCycleId);

      if (!cycle) {
        throw new Error(`Payment cycle ${paymentCycleId} not found`);
      }

      if (cycle.status === PaymentCycleStatus.COMPLETED) {
        throw new Error(`Payment cycle ${paymentCycleId} is already completed`);
      }

      // Update cycle status to completed
      cycle.status = PaymentCycleStatus.COMPLETED;
      await cycle.save();

      logger.info(
        {
          paymentCycleId: cycle._id.toString(),
          userId: cycle.userId,
        },
        'Closed payment cycle'
      );

      // TODO: Trigger generateConsolidatedBill
      // This will be implemented in a future task
      // await generateConsolidatedBill(cycle.userId, paymentCycleId);

      // Initialize new payment cycle for next month
      const nextMonthStart = new Date(cycle.endDate);
      nextMonthStart.setDate(nextMonthStart.getDate() + 1);
      nextMonthStart.setHours(0, 0, 0, 0);

      const nextMonthEnd = new Date(
        nextMonthStart.getFullYear(),
        nextMonthStart.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );

      const newCycle = await PaymentCycle.create({
        userId: cycle.userId,
        startDate: nextMonthStart,
        endDate: nextMonthEnd,
        status: PaymentCycleStatus.ACTIVE,
      });

      logger.info(
        {
          userId: cycle.userId,
          newPaymentCycleId: newCycle._id.toString(),
          startDate: nextMonthStart.toISOString(),
          endDate: nextMonthEnd.toISOString(),
        },
        'Initialized new payment cycle for next month'
      );

      return {
        closedCycle: cycle,
        newCycle,
      };
    } catch (error) {
      logger.error({ error, paymentCycleId }, 'Error closing payment cycle');
      throw error;
    }
  }
}

// Export singleton instance
export const paymentCycleService = new PaymentCycleService();
