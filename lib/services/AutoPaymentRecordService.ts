import AutoPaymentRecord, { IAutoPaymentRecord } from '../models/AutoPaymentRecord';
import PaymentCycle from '../models/PaymentCycle';
import logger from '../logger';

/**
 * AutoPaymentRecordService
 * Manages the creation and storage of automatic payment records
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5
 */
export class AutoPaymentRecordService {
  /**
   * Create an automatic payment record
   * Validates: Requirements 3.1, 3.2, 3.3, 3.5
   * 
   * @param params - Payment record parameters
   * @param params.userId - The user ID
   * @param params.billId - The bill ID
   * @param params.amount - The payment amount
   * @param params.transactionId - The transaction ID from BillAPI
   * @param params.billProvider - The bill provider name
   * @param params.billType - The bill type (electricity, water, mobile, etc.)
   * @param params.status - Payment status ('success' | 'failed' | 'settled')
   * @param params.paymentDate - Optional payment date (defaults to now)
   * @returns The created AutoPaymentRecord
   * @throws Error if validation fails or payment cycle not found
   */
  async createAutoPaymentRecord(params: {
    userId: string;
    billId: string;
    amount: number;
    transactionId: string;
    billProvider: string;
    billType: string;
    status?: 'success' | 'failed' | 'settled';
    paymentDate?: Date;
  }): Promise<IAutoPaymentRecord> {
    try {
      const {
        userId,
        billId,
        amount,
        transactionId,
        billProvider,
        billType,
        status = 'success',
        paymentDate = new Date(),
      } = params;

      // Validate required fields
      if (!userId || !billId || !amount || !transactionId || !billProvider || !billType) {
        throw new Error('Missing required fields for payment record creation');
      }

      // Find active payment cycle for the user
      const activeCycle = await PaymentCycle.findOne({ userId, status: 'active' });
      
      if (!activeCycle) {
        throw new Error(`No active payment cycle found for user ${userId}`);
      }

      // Create the payment record
      const record = await AutoPaymentRecord.create({
        userId,
        billId,
        amount,
        paymentDate,
        transactionId,
        billProvider,
        billType,
        status,
        paymentCycleId: activeCycle._id.toString(),
      });

      logger.info(
        {
          userId,
          billId,
          amount,
          transactionId,
          paymentCycleId: activeCycle._id.toString(),
          status,
        },
        'Created auto-payment record'
      );

      return record;
    } catch (error) {
      logger.error({ error, params }, 'Error creating auto-payment record');
      throw error;
    }
  }
}

// Export singleton instance
export const autoPaymentRecordService = new AutoPaymentRecordService();
