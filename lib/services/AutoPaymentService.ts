import AutoPaymentConfig, { IAutoPaymentConfig } from '../models/AutoPaymentConfig';
import Bill from '../models/Bill';
import connectDB from '../mongoose';
import logger from '../logger';
import { notificationService } from './NotificationService';
import PaymentCycle from '../models/PaymentCycle';
import { auditLogService } from './AuditLogService';

/**
 * AutoPaymentService
 * Handles business logic for enabling and disabling automatic bill payments
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5
 */
export class AutoPaymentService {
  /**
   * Enable automatic payment for a bill
   * Validates: Requirements 1.1, 1.2, 1.5
   * 
   * @param userId - The user ID
   * @param billId - The bill ID to enable auto-payment for
   * @returns The created or updated AutoPaymentConfig
   * @throws Error if validation fails or bill details cannot be retrieved
   */
  async enableAutomaticPayment(
    userId: string,
    billId: string
  ): Promise<IAutoPaymentConfig> {
    try {
      await connectDB();

      // Normalize billId to the canonical string ID from the Bill model
      const bill = await this.findBillByAnyId(billId);
      if (!bill) {
        throw new Error(`Bill ${billId} not found`);
      }
      const canonicalBillId = bill.billId || billId;

      // Validate user has valid payment method
      await this.validatePaymentMethod(userId);

      // Check if config already exists using either canonical ID or original ID
      let config = await AutoPaymentConfig.findOne({
        userId,
        $or: [{ billId: canonicalBillId }, { billId: billId }]
      });

      if (config) {
        // Update to canonical ID if it was using a legacy ID
        if (config.billId !== canonicalBillId) {
          config.billId = canonicalBillId;
        }

        // Re-enable if it was disabled
        if (!config.enabled) {
          config.enabled = true;
          config.disabledReason = undefined;
          await config.save();
          logger.info(`Re-enabled auto-payment for user ${userId}, bill ${canonicalBillId}`);
        } else {
          await config.save(); // Save the ID update if needed
        }
      } else {
        // Create new config using canonical ID
        config = await AutoPaymentConfig.create({
          userId,
          billId: canonicalBillId,
          enabled: true,
        });
        logger.info(`Created auto-payment config for user ${userId}, bill ${canonicalBillId}`);
      }

      // Audit log
      const { auditLogService } = await import('./AuditLogService');
      await auditLogService.logAutoPaymentEnable(userId, canonicalBillId, config._id.toString());

      return config;
    } catch (error) {
      logger.error({ error }, 'Error enabling automatic payment');
      throw error;
    }
  }

  /**
   * Disable automatic payment for a bill
   * Validates: Requirements 1.3
   * 
   * @param userId - The user ID
   * @param billId - The bill ID to disable auto-payment for
   * @param reason - Optional reason for disabling
   * @returns The updated AutoPaymentConfig
   * @throws Error if config not found
   */
  async disableAutomaticPayment(
    userId: string,
    billId: string,
    reason?: string
  ): Promise<IAutoPaymentConfig> {
    try {
      await connectDB();

      // Normalize billId
      const bill = await this.findBillByAnyId(billId);
      const canonicalBillId = bill ? (bill.billId || billId) : billId;

      const config = await AutoPaymentConfig.findOne({ userId, billId: canonicalBillId });

      if (!config) {
        throw new Error(`Auto-payment config not found for user ${userId}, bill ${canonicalBillId}`);
      }

      config.enabled = false;
      if (reason) {
        config.disabledReason = reason;
      }
      await config.save();

      logger.info({ userId, billId: canonicalBillId, reason }, 'Disabled auto-payment');

      // Audit log
      const { auditLogService } = await import('./AuditLogService');
      await auditLogService.logAutoPaymentDisable(userId, canonicalBillId, config._id.toString(), reason);

      return config;
    } catch (error) {
      logger.error({ error }, 'Error disabling automatic payment');
      throw error;
    }
  }

  /**
   * Validate that user has a valid payment method
   * Validates: Requirements 1.5, 9.2
   * 
   * @param userId - The user ID to validate
   * @throws Error if payment method is invalid or missing
   */
  private async validatePaymentMethod(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required for payment method validation');
    }

    // Use PaymentMethodService to validate
    const { paymentMethodService } = await import('./PaymentMethodService');

    try {
      await paymentMethodService.validatePaymentMethod(userId);
      logger.debug(`Payment method validation passed for user ${userId}`);
      return;
    } catch (error) {
      logger.error({ error, userId }, 'Payment method validation failed');

      // Try to create default payment method from environment variables
      if (error instanceof Error && error.message.includes('No payment method found')) {
        const { ensureDefaultPaymentMethod } = await import('../utils/default-payment-method');
        const created = await ensureDefaultPaymentMethod(userId);

        if (created) {
          logger.info({ userId }, 'Created default payment method from environment variables');
          // Validate again after creating - this time it should pass
          try {
            await paymentMethodService.validatePaymentMethod(userId);
            logger.debug(`Payment method validation passed after creation for user ${userId}`);
            return;
          } catch (validationError) {
            logger.error({ error: validationError, userId }, 'Payment method validation failed after creation');
            throw validationError;
          }
        }
      }

      // If payment method is expired, pause all auto-payments
      if (error instanceof Error && error.message.includes('expired')) {
        await paymentMethodService.pauseAllAutoPayments(userId, 'Payment method expired');
      }

      throw error;
    }
  }

  /**
   * Retrieve and validate bill details from internal database
   * Supports lookup by both the billId string field AND MongoDB _id ObjectId
   */
  private async validateBillDetails(billId: string): Promise<void> {
    try {
      const bill = await this.findBillByAnyId(billId);
      if (!bill) {
        throw new Error(`Bill ${billId} not found`);
      }
      logger.debug({ billId, amount: bill.amount, dueDate: bill.dueDate }, 'Bill validation passed');
    } catch (error) {
      logger.error({ error, billId }, 'Error validating bill details');
      throw error;
    }
  }

  /**
   * Find a bill by either its billId string field or MongoDB _id.
   * The mobile app sends _id (ObjectId string), the service originally queried billId field only.
   */
  private async findBillByAnyId(id: string) {
    const mongoose = await import('mongoose');
    // 1. Try the billId string field first
    let bill = await Bill.findOne({ billId: id });
    if (bill) return bill;
    // 2. Fall back to _id lookup if it looks like an ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      bill = await Bill.findById(id);
    }
    return bill;
  }

  /**
   * Get auto-payment status for a bill
   * Validates: Requirement 1.4
   * 
   * @param userId - The user ID
   * @param billId - The bill ID
   * @returns The AutoPaymentConfig if exists, null otherwise
   */
  async getAutoPaymentStatus(
    userId: string,
    billId: string
  ): Promise<IAutoPaymentConfig | null> {
    try {
      await connectDB();
      // Normalize billId for consistent lookup
      const bill = await this.findBillByAnyId(billId);
      const canonicalBillId = bill ? (bill.billId || billId) : billId;

      return await AutoPaymentConfig.findOne({
        userId,
        $or: [
          { billId: canonicalBillId },
          { billId: billId } // fallback to handle legacy IDs
        ]
      });
    } catch (error) {
      logger.error({ error }, 'Error getting auto-payment status');
      throw error;
    }
  }

  /**
   * List all bills with auto-payment enabled for a user
   * 
   * @param userId - The user ID
   * @returns Array of AutoPaymentConfig records
   */
  async listEnabledAutoPayments(userId: string): Promise<IAutoPaymentConfig[]> {
    try {
      await connectDB();
      return await AutoPaymentConfig.find({ userId, enabled: true });
    } catch (error) {
      logger.error({ error }, 'Error listing enabled auto-payments');
      throw error;
    }
  }

  /**
   * List all auto-payment configs for a user (both enabled and disabled)
   *
   * @param userId - The user ID
   * @returns Array of AutoPaymentConfig records
   */
  async listAllAutoPayments(userId: string): Promise<IAutoPaymentConfig[]> {
    try {
      await connectDB();
      return await AutoPaymentConfig.find({ userId });
    } catch (error) {
      logger.error({ error }, 'Error listing all auto-payments');
      throw error;
    }
  }




  /**
   * Process a single bill for automatic payment
   * 
   * @param config - The auto-payment configuration
   * @returns Result of processing
   */
  private async processSingleBill(config: IAutoPaymentConfig): Promise<{
    billId: string;
    userId: string;
    status: 'processed' | 'skipped' | 'error';
    reason?: string;
  }> {
    const { userId, billId } = config;

    // Retrieve bill details
    const billDetails = await this.getBillDetails(billId);

    // Logging the intent to process (removed due date checks as requested)
    logger.info({ billId, userId, amount: billDetails.amount, dueDate: billDetails.dueDate }, 'Processing bill for auto-payment trigger');

    // If all checks pass, mark as ready for processing
    return {
      billId,
      userId,
      status: 'processed',
      reason: 'Ready for payment execution',
    };
  }

  /**
   * Get bill details from internal database
   * 
   * @param billId - The bill ID
   * @returns Bill details
   */
  private async getBillDetails(billId: string): Promise<{
    id: string;
    amount: number;
    dueDate: Date;
    provider: string;
    type: string;
  }> {
    const bill = await this.findBillByAnyId(billId);

    if (!bill) {
      throw new Error(`Bill ${billId} not found`);
    }

    let dueDate = (bill as any).dueDate;

    // If dueDate is missing but dueDay is present (common for admin-managed bills), 
    // calculate the dueDate for the current month
    if (!dueDate && (bill as any).dueDay) {
      const now = new Date();
      dueDate = new Date(now.getFullYear(), now.getMonth(), (bill as any).dueDay);
    }

    return {
      id: bill.billId || bill._id.toString(),
      amount: bill.amount || 0,
      dueDate: dueDate,
      provider: bill.provider,
      type: bill.billType,
    };
  }

  /**
   * Check if a bill is due within 24 hours
   * 
   * @param dueDate - The bill due date
   * @returns True if due within 24 hours
   */
  private isDueWithin24Hours(dueDate: Date): boolean {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return dueDate <= twentyFourHoursFromNow && dueDate >= now;
  }

  /**
   * Check if a bill is overdue
   * 
   * @param dueDate - The bill due date
   * @returns True if bill is past its due date
   */
  private isOverdue(dueDate: Date): boolean {
    const now = new Date();
    return dueDate < now;
  }

  /**
   * Check for duplicate payments in current cycle
   * 
   * @param userId - The user ID
   * @param billId - The bill ID
   * @returns True if duplicate payment exists
   */
  private async checkDuplicatePayment(userId: string, billId: string): Promise<boolean> {
    const AutoPaymentRecord = (await import('../models/AutoPaymentRecord')).default;
    const PaymentCycle = (await import('../models/PaymentCycle')).default;

    const activeCycle = await PaymentCycle.findOne({ userId, status: 'active' });

    if (!activeCycle) {
      return false;
    }

    const existingRecord = await AutoPaymentRecord.findOne({
      userId,
      billId,
      paymentCycleId: activeCycle._id.toString(),
      status: { $in: ['success', 'settled'] },
    });

    return existingRecord !== null;
  }

  /**
   * Detect significant amount changes (>50% increase)
   * 
   * @param userId - The user ID
   * @param billId - The bill ID
   * @param currentAmount - The current bill amount
   * @returns Object with hasChange boolean and previousAmount (or null if no previous payment)
   */
  private async detectSignificantAmountChange(
    userId: string,
    billId: string,
    currentAmount: number
  ): Promise<{ hasChange: boolean; previousAmount: number | null }> {
    const AutoPaymentRecord = (await import('../models/AutoPaymentRecord')).default;

    const lastPayment = await AutoPaymentRecord.findOne({
      userId,
      billId,
      status: { $in: ['success', 'settled'] },
    }).sort({ paymentDate: -1 });

    if (!lastPayment) {
      return { hasChange: false, previousAmount: null };
    }

    const percentageIncrease = ((currentAmount - lastPayment.amount) / lastPayment.amount) * 100;

    return {
      hasChange: percentageIncrease > 50,
      previousAmount: lastPayment.amount
    };
  }

  /**
   * Execute payment for a bill through BillAPI
   * 
   * @param userId - The user ID
   * @param billId - The bill ID
   * @param amount - The payment amount
   * @param billProvider - The bill provider name
   * @param billType - The bill type
   * @returns The created AutoPaymentRecord
   * @throws Error if payment fails
   */
  async executePayment(
    userId: string,
    billId: string,
    amount: number,
    billProvider: string,
    billType: string
  ): Promise<any> {
    try {
      await connectDB();

      const AutoPaymentRecord = (await import('../models/AutoPaymentRecord')).default;
      // Normalize billId to the canonical string ID for record lookup and creation
      const bill = await this.findBillByAnyId(billId);
      const canonicalBillId = bill ? (bill.billId || billId) : billId;

      const activeCycle = await PaymentCycle.findOne({ userId, status: 'active' });
      if (!activeCycle) {
        throw new Error(`No active payment cycle found for user ${userId}`);
      }

      // We still check for literal duplicates here to prevent double charging the same transactionId/cycle
      // Check both current ID and canonical ID for duplicates
      const existingRecord = await AutoPaymentRecord.findOne({
        userId,
        $or: [
          { billId: canonicalBillId },
          { billId: billId }
        ],
        paymentCycleId: activeCycle._id.toString(),
        status: { $in: ['success', 'settled'] },
      });

      if (existingRecord) {
        logger.info({ billId: canonicalBillId, userId }, 'Payment already exists in current cycle, skipping execution');
        return existingRecord;
      }

      await auditLogService.logPaymentAttempt(userId, canonicalBillId, amount, 1);

      const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const billToUpdate = bill || await this.findBillByAnyId(canonicalBillId);
      if (billToUpdate) {
        billToUpdate.status = 'paid';
        billToUpdate.paymentId = transactionId;
        billToUpdate.paidAt = new Date();

        // Update the most recent pending monthly record if it exists
        if (billToUpdate.monthlyRecords && billToUpdate.monthlyRecords.length > 0) {
          const pendingRecords = billToUpdate.monthlyRecords
            .filter(r => r.status === 'pending')
            .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

          if (pendingRecords.length > 0) {
            // Find the index of the first pending record to update it correctly in the array
            const recordIndex = billToUpdate.monthlyRecords.findIndex(r => r.id === pendingRecords[0].id);
            if (recordIndex !== -1) {
              billToUpdate.monthlyRecords[recordIndex].status = 'paid';
              billToUpdate.monthlyRecords[recordIndex].paymentId = transactionId;
              billToUpdate.monthlyRecords[recordIndex].paidAt = new Date();
              logger.info({ billId: canonicalBillId, recordId: pendingRecords[0].id }, 'Updated monthly record status to paid');
            }
          }
        }

        await billToUpdate.save();
        logger.info({ billId: canonicalBillId, amount, transactionId }, 'Successfully updated bill status and records to paid');
      } else {
        logger.warn({ billId: canonicalBillId }, 'Could not find bill to update status after payment');
      }

      logger.info({ billId: canonicalBillId, amount, transactionId }, 'Successfully paid bill through internal system');

      let record = await AutoPaymentRecord.create({
        userId,
        billId: canonicalBillId, // Always use canonical ID for new records
        amount,
        paymentDate: new Date(),
        transactionId: transactionId,
        billProvider,
        billType,
        status: 'success',
        paymentCycleId: activeCycle._id.toString(),
      });

      logger.info({ userId, billId, amount, transactionId: record.transactionId }, 'Payment executed successfully');

      await auditLogService.logPaymentSuccess(userId, billId, amount, record.transactionId, record._id.toString());

      await notificationService.notifyPaymentSuccess(userId, billId, amount, record.transactionId);

      return record;
    } catch (error) {
      logger.error({ error, userId, billId, amount }, 'Error executing payment');

      const { auditLogService } = await import('./AuditLogService');
      await auditLogService.logPaymentFailure(
        userId,
        billId,
        amount,
        error instanceof Error ? error.message : 'Unknown error',
        1
      );

      throw error;
    }
  }

  /**
   * Retry a failed payment 
   */
  async retryFailedPayment(
    userId: string,
    billId: string,
    amount: number,
    billProvider: string,
    billType: string,
    attemptNumber: number = 1
  ): Promise<any | null> {
    try {
      await connectDB();

      const maxAttempts = 3;
      const { auditLogService } = await import('./AuditLogService');

      logger.info({ userId, billId, attemptNumber }, `Retrying payment (attempt ${attemptNumber}/${maxAttempts})`);

      if (attemptNumber > maxAttempts) {
        await this.disableAutomaticPayment(userId, billId, 'Payment failed after 3 retry attempts');
        await notificationService.notifyPaymentFailedFinal(userId, billId, amount);
        return null;
      }

      await auditLogService.logPaymentRetry(userId, billId, amount, attemptNumber);

      try {
        const record = await this.executePayment(userId, billId, amount, billProvider, billType);
        return record;
      } catch (error) {
        logger.error({ error, userId, billId, attemptNumber }, 'Payment retry failed');

        await auditLogService.logPaymentFailure(
          userId,
          billId,
          amount,
          error instanceof Error ? error.message : 'Unknown error',
          attemptNumber
        );

        if (attemptNumber >= maxAttempts) {
          await this.disableAutomaticPayment(userId, billId, 'Payment failed after 3 retry attempts');
          await notificationService.notifyPaymentFailedFinal(userId, billId, amount);
          return null;
        }

        await notificationService.notifyPaymentRetry(userId, billId, amount, attemptNumber);

        return this.retryFailedPayment(userId, billId, amount, billProvider, billType, attemptNumber + 1);
      }
    } catch (error) {
      logger.error({ error, userId, billId, attemptNumber }, 'Error in retryFailedPayment');
      throw error;
    }
  }

  /**
   * Process scheduled payments 
   */
  async processScheduledPayments(): Promise<Array<{
    billId: string;
    userId: string;
    status: 'processed' | 'skipped' | 'error';
    reason?: string;
  }>> {
    try {
      await connectDB();
      const results: any[] = [];
      const configs = await AutoPaymentConfig.find({ enabled: true });
      for (const config of configs) {
        try {
          const result = await this.processSingleBill(config);
          results.push(result);
        } catch (error) {
          results.push({
            billId: config.billId,
            userId: config.userId,
            status: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process scheduled payments with execution
   */
  async processScheduledPaymentsWithExecution(): Promise<Array<{
    billId: string;
    userId: string;
    status: 'success' | 'failed' | 'skipped' | 'error';
    reason?: string;
    transactionId?: string;
  }>> {
    try {
      await connectDB();
      const results: any[] = [];
      const configs = await AutoPaymentConfig.find({ enabled: true });
      for (const config of configs) {
        try {
          const result = await this.processSingleBillWithExecution(config);
          results.push(result);
        } catch (error) {
          results.push({
            billId: config.billId,
            userId: config.userId,
            status: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process a single bill with payment execution
   */
  private async processSingleBillWithExecution(config: IAutoPaymentConfig): Promise<{
    billId: string;
    userId: string;
    status: 'success' | 'failed' | 'skipped' | 'error';
    reason?: string;
    transactionId?: string;
  }> {
    const { userId, billId } = config;

    try {
      // Retrieve bill details
      const billDetails = await this.getBillDetails(billId);

      // Logging (removed all skip conditions)
      logger.info({ billId, userId, amount: billDetails.amount, dueDate: billDetails.dueDate }, 'Processing bill for auto-payment trigger execution');

      // Execute payment
      const record = await this.executePayment(
        userId,
        billId,
        billDetails.amount,
        billDetails.provider,
        billDetails.type
      );

      return {
        billId,
        userId,
        status: 'success',
        transactionId: record.transactionId,
      };
    } catch (error) {
      logger.error({ error, billId, userId }, 'Payment execution failed, initiating retry logic');

      const billDetails = await this.getBillDetails(billId);

      try {
        const record = await this.retryFailedPayment(
          userId,
          billId,
          billDetails.amount,
          billDetails.provider,
          billDetails.type,
          1
        );

        if (record) {
          return {
            billId,
            userId,
            status: 'success',
            transactionId: record.transactionId,
            reason: 'Succeeded after retry',
          };
        } else {
          return {
            billId,
            userId,
            status: 'failed',
            reason: 'Failed after 3 retry attempts or already paid',
          };
        }
      } catch (retryError) {
        return {
          billId,
          userId,
          status: 'failed',
          reason: retryError instanceof Error ? retryError.message : 'Unknown error during retry',
        };
      }
    }
  }
}

export const autoPaymentService = new AutoPaymentService();
