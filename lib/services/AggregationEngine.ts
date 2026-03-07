import AutoPaymentRecord from '../models/AutoPaymentRecord';
import ConsolidatedBill, { IConsolidatedBill } from '../models/ConsolidatedBill';
import PaymentCycle from '../models/PaymentCycle';
import logger from '../logger';

/**
 * AggregationEngine
 * Service responsible for consolidating multiple auto-paid bills into a single consolidated bill
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6
 */
export class AggregationEngine {
  /**
   * Generate a consolidated bill for a user's payment cycle
   * Queries all AutoPaymentRecords for the user in the payment cycle,
   * calculates the total amount, and creates a ConsolidatedBill with itemized list
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6
   * 
   * @param userId - The user ID
   * @param paymentCycleId - The payment cycle ID
   * @returns The created ConsolidatedBill, or null if no records exist
   * @throws Error if validation fails or payment cycle not found
   */
  async generateConsolidatedBill(
    userId: string,
    paymentCycleId: string
  ): Promise<IConsolidatedBill | null> {
    try {
      // Validate required parameters
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (!paymentCycleId) {
        throw new Error('Payment cycle ID is required');
      }

      // Retrieve the payment cycle
      const paymentCycle = await PaymentCycle.findById(paymentCycleId);
      
      if (!paymentCycle) {
        throw new Error(`Payment cycle ${paymentCycleId} not found`);
      }

      // Verify the payment cycle belongs to the user
      if (paymentCycle.userId !== userId) {
        throw new Error('Payment cycle does not belong to the specified user');
      }

      // Query all successful AutoPaymentRecords for user in payment cycle
      // Requirement 4.2: Include all Auto_Payment_Records from the Payment_Cycle
      const autoPaymentRecords = await AutoPaymentRecord.find({
        userId,
        paymentCycleId,
        status: { $in: ['success', 'settled'] }, // Include both success and settled records
      });

      // Requirement 4.6: Skip generation if no records exist
      if (autoPaymentRecords.length === 0) {
        logger.info(
          { userId, paymentCycleId },
          'No auto-payment records found for payment cycle, skipping consolidated bill generation'
        );
        return null;
      }

      // Requirement 4.3: Calculate total amount by summing all record amounts
      const totalAmount = autoPaymentRecords.reduce(
        (sum, record) => sum + record.amount,
        0
      );

      // Link all AutoPaymentRecord IDs to consolidated bill
      const autoPaymentRecordIds = autoPaymentRecords.map((record) =>
        record._id.toString()
      );

      // Create ConsolidatedBill with itemized list
      // Requirement 4.1: Generate a Consolidated_Bill at the end of each Payment_Cycle
      // Requirement 4.4: List each Individual_Bill with provider name, bill type, amount, and payment date
      const consolidatedBill = await ConsolidatedBill.create({
        userId,
        paymentCycleId,
        cycleStartDate: paymentCycle.startDate,
        cycleEndDate: paymentCycle.endDate,
        totalAmount,
        autoPaymentRecords: autoPaymentRecordIds,
        status: 'pending',
      });

      logger.info(
        {
          userId,
          paymentCycleId,
          consolidatedBillId: consolidatedBill._id.toString(),
          totalAmount,
          recordCount: autoPaymentRecords.length,
        },
        'Generated consolidated bill'
      );

      return consolidatedBill;
    } catch (error) {
      logger.error(
        { error, userId, paymentCycleId },
        'Error generating consolidated bill'
      );
      throw error;
    }
  }
}

// Export singleton instance
export const aggregationEngine = new AggregationEngine();
