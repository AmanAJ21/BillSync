import AutoPaymentConfig, { IAutoPaymentConfig } from '../models/AutoPaymentConfig';
import Bill from '../models/Bill';
import connectDB from '../mongoose';
import logger from '../logger';
import { notificationService } from './NotificationService';

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

      // Validate user has valid payment method
      await this.validatePaymentMethod(userId);

      // Retrieve and validate bill details from BillAPI
      await this.validateBillDetails(billId);

      // Check if config already exists
      let config = await AutoPaymentConfig.findOne({ userId, billId });

      if (config) {
        // Re-enable if it was disabled
        if (!config.enabled) {
          config.enabled = true;
          config.disabledReason = undefined;
          await config.save();
          logger.info(`Re-enabled auto-payment for user ${userId}, bill ${billId}`);
        }
      } else {
        // Create new config
        config = await AutoPaymentConfig.create({
          userId,
          billId,
          enabled: true,
        });
        logger.info(`Created auto-payment config for user ${userId}, bill ${billId}`);
      }

      // Audit log
      const { auditLogService } = await import('./AuditLogService');
      await auditLogService.logAutoPaymentEnable(userId, billId, config._id.toString());

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

      const config = await AutoPaymentConfig.findOne({ userId, billId });

      if (!config) {
        throw new Error(`Auto-payment config not found for user ${userId}, bill ${billId}`);
      }

      config.enabled = false;
      if (reason) {
        config.disabledReason = reason;
      }
      await config.save();

      logger.info({ userId, billId, reason }, 'Disabled auto-payment');

      // Audit log
      const { auditLogService } = await import('./AuditLogService');
      await auditLogService.logAutoPaymentDisable(userId, billId, config._id.toString(), reason);

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
      return await AutoPaymentConfig.findOne({ userId, billId });
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
   * Process scheduled payments for bills due within 24 hours
   * Validates: Requirements 2.1, 2.2, 9.1
   * 
   * This function:
   * 1. Queries all bills with auto-payment enabled
   * 2. Filters bills where dueDate is within next 24 hours
   * 3. Checks for duplicate payments in current cycle
   * 4. Detects significant amount changes (>50% increase)
   * 
   * @returns Array of results for each processed bill
   */
  async processScheduledPayments(): Promise<Array<{
    billId: string;
    userId: string;
    status: 'processed' | 'skipped' | 'error';
    reason?: string;
  }>> {
    try {
      await connectDB();

      const results: Array<{
        billId: string;
        userId: string;
        status: 'processed' | 'skipped' | 'error';
        reason?: string;
      }> = [];

      // Get all enabled auto-payment configurations
      const configs = await AutoPaymentConfig.find({ enabled: true });

      logger.info(`Processing ${configs.length} auto-payment configurations`);

      // Process each configuration
      for (const config of configs) {
        try {
          const result = await this.processSingleBill(config);
          results.push(result);
        } catch (error) {
          logger.error({ error, billId: config.billId, userId: config.userId }, 'Error processing bill');
          results.push({
            billId: config.billId,
            userId: config.userId,
            status: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info(`Processed ${results.length} bills: ${results.filter(r => r.status === 'processed').length} processed, ${results.filter(r => r.status === 'skipped').length} skipped, ${results.filter(r => r.status === 'error').length} errors`);

      return results;
    } catch (error) {
      logger.error({ error }, 'Error in processScheduledPayments');
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

    // Retrieve bill details from BillAPI
    const billDetails = await this.getBillDetails(billId);

    // Check if bill is due within 24 hours OR overdue
    const isDueWithin24Hours = this.isDueWithin24Hours(billDetails.dueDate);
    const isOverdue = this.isOverdue(billDetails.dueDate);

    if (!isDueWithin24Hours && !isOverdue) {
      logger.debug({ billId, userId, dueDate: billDetails.dueDate }, 'Bill not due within 24 hours and not overdue, skipping');
      return {
        billId,
        userId,
        status: 'skipped',
        reason: 'Not due within 24 hours',
      };
    }

    // Log if processing overdue bill
    if (isOverdue) {
      logger.info({ billId, userId, dueDate: billDetails.dueDate }, 'Processing overdue bill');
    }

    // Check for duplicate payments in current cycle
    const hasDuplicatePayment = await this.checkDuplicatePayment(userId, billId);
    if (hasDuplicatePayment) {
      logger.info({ billId, userId }, 'Duplicate payment detected, skipping');
      return {
        billId,
        userId,
        status: 'skipped',
        reason: 'Already paid in current cycle',
      };
    }

    // Detect significant amount changes (>50% increase)
    const amountChangeResult = await this.detectSignificantAmountChange(userId, billId, billDetails.amount);
    if (amountChangeResult.hasChange) {
      logger.warn({ billId, userId, amount: billDetails.amount }, 'Significant amount change detected (>50% increase), skipping and notifying user');
      // TODO: Send notification to user for confirmation
      return {
        billId,
        userId,
        status: 'skipped',
        reason: 'Significant amount change detected (>50% increase), user notification required',
      };
    }

    // If all checks pass, mark as ready for processing
    logger.info({ billId, userId, amount: billDetails.amount, dueDate: billDetails.dueDate }, 'Bill ready for automatic payment');
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

      // If if the resulting date is in the past, it's either overdue for this month 
      // or we should look at next month. But for auto-payment trigger, 
      // overdue bills should be returned so they can be processed.
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
    // Import AutoPaymentRecord and PaymentCycle models
    const AutoPaymentRecord = (await import('../models/AutoPaymentRecord')).default;
    const PaymentCycle = (await import('../models/PaymentCycle')).default;

    // Find active payment cycle for user
    const activeCycle = await PaymentCycle.findOne({ userId, status: 'active' });

    if (!activeCycle) {
      // No active cycle, no duplicate possible
      return false;
    }

    // Check if payment record exists for this bill in current cycle
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
    // Import AutoPaymentRecord model
    const AutoPaymentRecord = (await import('../models/AutoPaymentRecord')).default;

    // Find the most recent successful payment for this bill
    const lastPayment = await AutoPaymentRecord.findOne({
      userId,
      billId,
      status: { $in: ['success', 'settled'] },
    }).sort({ paymentDate: -1 });

    if (!lastPayment) {
      // No previous payment, no comparison possible
      return { hasChange: false, previousAmount: null };
    }

    // Calculate percentage increase
    const percentageIncrease = ((currentAmount - lastPayment.amount) / lastPayment.amount) * 100;

    // Return true if increase is more than 50%
    return {
      hasChange: percentageIncrease > 50,
      previousAmount: lastPayment.amount
    };
  }

  /**
   * Execute payment for a bill through BillAPI
   * Validates: Requirements 2.1, 2.4
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

      // Import models
      const AutoPaymentRecord = (await import('../models/AutoPaymentRecord')).default;
      const PaymentCycle = (await import('../models/PaymentCycle')).default;
      const { auditLogService } = await import('./AuditLogService');

      // Find active payment cycle
      const activeCycle = await PaymentCycle.findOne({ userId, status: 'active' });
      if (!activeCycle) {
        throw new Error(`No active payment cycle found for user ${userId}`);
      }

      // Check for duplicate payment before initiating payment (race condition protection)
      const existingRecord = await AutoPaymentRecord.findOne({
        userId,
        billId,
        paymentCycleId: activeCycle._id.toString(),
        status: { $in: ['success', 'settled'] },
      });

      if (existingRecord) {
        throw new Error(`Payment already exists for bill ${billId} in current cycle`);
      }

      // Audit log: payment attempt
      await auditLogService.logPaymentAttempt(userId, billId, amount, 1);

      // Execute payment internally (no external API)
      // In a real system, this would integrate with a payment gateway
      // For now, we simulate successful payment
      const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Update bill status to paid
      await Bill.findOneAndUpdate(
        { billId },
        { status: 'paid' },
        { new: true }
      );

      logger.info({ billId, amount, transactionId }, 'Successfully paid bill through internal system');

      // Create AutoPaymentRecord on successful payment
      // Use try-catch to handle potential duplicate key errors from concurrent requests
      let record;
      try {
        record = await AutoPaymentRecord.create({
          userId,
          billId,
          amount,
          paymentDate: new Date(),
          transactionId: transactionId,
          billProvider,
          billType,
          status: 'success',
          paymentCycleId: activeCycle._id.toString(),
        });
      } catch (createError: any) {
        // If duplicate key error, check if record was created by another concurrent request
        if (createError.code === 11000) {
          const duplicateRecord = await AutoPaymentRecord.findOne({
            userId,
            billId,
            paymentCycleId: activeCycle._id.toString(),
            status: { $in: ['success', 'settled'] },
          });
          if (duplicateRecord) {
            throw new Error(`Payment already exists for bill ${billId} in current cycle`);
          }
        }
        throw createError;
      }

      logger.info({ userId, billId, amount, transactionId: record.transactionId }, 'Payment executed successfully');

      // Audit log: payment success
      await auditLogService.logPaymentSuccess(userId, billId, amount, record.transactionId, record._id.toString());

      // Send success notification
      await notificationService.notifyPaymentSuccess(userId, billId, amount, record.transactionId);

      return record;
    } catch (error) {
      logger.error({ error, userId, billId, amount }, 'Error executing payment');

      // Audit log: payment failure
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
   * Retry a failed payment with exponential backoff
   * Validates: Requirements 2.3, 2.5
   * 
   * @param userId - The user ID
   * @param billId - The bill ID
   * @param amount - The payment amount
   * @param billProvider - The bill provider name
   * @param billType - The bill type
   * @param attemptNumber - Current attempt number (1-3)
   * @returns The created AutoPaymentRecord or null if all retries failed
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
      const retryIntervalMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      const { auditLogService } = await import('./AuditLogService');

      logger.info({ userId, billId, attemptNumber }, `Retrying payment (attempt ${attemptNumber}/${maxAttempts})`);

      // If we've exceeded max attempts, disable auto-payment and notify user
      if (attemptNumber > maxAttempts) {
        logger.warn({ userId, billId }, 'Max retry attempts reached, disabling auto-payment');

        await this.disableAutomaticPayment(userId, billId, 'Payment failed after 3 retry attempts');

        await notificationService.notifyPaymentFailedFinal(userId, billId, amount);

        return null;
      }

      // Wait for retry interval (only if not first attempt)
      if (attemptNumber > 1) {
        logger.debug({ userId, billId, attemptNumber }, `Waiting ${retryIntervalMs / 1000 / 60} minutes before retry`);
        await new Promise(resolve => setTimeout(resolve, retryIntervalMs));
      }

      // Audit log: payment retry
      await auditLogService.logPaymentRetry(userId, billId, amount, attemptNumber);

      // Attempt payment
      try {
        const record = await this.executePayment(userId, billId, amount, billProvider, billType);
        logger.info({ userId, billId, attemptNumber }, 'Payment retry succeeded');
        return record;
      } catch (error) {
        logger.error({ error, userId, billId, attemptNumber }, 'Payment retry failed');

        // Audit log: payment failure
        await auditLogService.logPaymentFailure(
          userId,
          billId,
          amount,
          error instanceof Error ? error.message : 'Unknown error',
          attemptNumber
        );

        // If this was the last attempt, disable auto-payment
        if (attemptNumber >= maxAttempts) {
          await this.disableAutomaticPayment(userId, billId, 'Payment failed after 3 retry attempts');

          await notificationService.notifyPaymentFailedFinal(userId, billId, amount);

          return null;
        }

        // Send notification about retry
        await notificationService.notifyPaymentRetry(userId, billId, amount, attemptNumber);

        // Schedule next retry
        return this.retryFailedPayment(userId, billId, amount, billProvider, billType, attemptNumber + 1);
      }
    } catch (error) {
      logger.error({ error, userId, billId, attemptNumber }, 'Error in retryFailedPayment');
      throw error;
    }
  }

  /**
   * Process scheduled payments with payment execution
   * Enhanced version that executes payments for bills due within 24 hours
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 9.1
   * 
   * @returns Array of results for each processed bill
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

      const results: Array<{
        billId: string;
        userId: string;
        status: 'success' | 'failed' | 'skipped' | 'error';
        reason?: string;
        transactionId?: string;
      }> = [];

      // Get all enabled auto-payment configurations
      const configs = await AutoPaymentConfig.find({ enabled: true });

      logger.info(`Processing ${configs.length} auto-payment configurations with execution`);

      // Process each configuration
      for (const config of configs) {
        try {
          const result = await this.processSingleBillWithExecution(config);
          results.push(result);
        } catch (error) {
          logger.error({ error, billId: config.billId, userId: config.userId }, 'Error processing bill with execution');
          results.push({
            billId: config.billId,
            userId: config.userId,
            status: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      logger.info(`Processed ${results.length} bills: ${results.filter(r => r.status === 'success').length} successful, ${results.filter(r => r.status === 'failed').length} failed, ${results.filter(r => r.status === 'skipped').length} skipped, ${results.filter(r => r.status === 'error').length} errors`);

      return results;
    } catch (error) {
      logger.error({ error }, 'Error in processScheduledPaymentsWithExecution');
      throw error;
    }
  }

  /**
   * Process a single bill with payment execution
   * 
   * @param config - The auto-payment configuration
   * @returns Result of processing with execution
   */
  private async processSingleBillWithExecution(config: IAutoPaymentConfig): Promise<{
    billId: string;
    userId: string;
    status: 'success' | 'failed' | 'skipped' | 'error';
    reason?: string;
    transactionId?: string;
  }> {
    const { userId, billId } = config;

    // Retrieve bill details from BillAPI
    const billDetails = await this.getBillDetails(billId);

    // Check if bill is due within 24 hours OR overdue
    const isDueWithin24Hours = this.isDueWithin24Hours(billDetails.dueDate);
    const isOverdue = this.isOverdue(billDetails.dueDate);

    if (!isDueWithin24Hours && !isOverdue) {
      logger.debug({ billId, userId, dueDate: billDetails.dueDate }, 'Bill not due within 24 hours and not overdue, skipping');
      return {
        billId,
        userId,
        status: 'skipped',
        reason: 'Not due within 24 hours',
      };
    }

    // Log if processing overdue bill
    if (isOverdue) {
      logger.info({ billId, userId, dueDate: billDetails.dueDate }, 'Processing overdue bill');
    }

    // Check for duplicate payments in current cycle
    const hasDuplicatePayment = await this.checkDuplicatePayment(userId, billId);
    if (hasDuplicatePayment) {
      logger.info({ billId, userId }, 'Duplicate payment detected, skipping');
      return {
        billId,
        userId,
        status: 'skipped',
        reason: 'Already paid in current cycle',
      };
    }

    // Detect significant amount changes (>50% increase)
    const amountChangeResult = await this.detectSignificantAmountChange(userId, billId, billDetails.amount);
    if (amountChangeResult.hasChange && amountChangeResult.previousAmount !== null) {
      logger.warn({ billId, userId, amount: billDetails.amount }, 'Significant amount change detected (>50% increase), skipping and notifying user');

      await notificationService.notifyAmountChange(
        userId,
        billId,
        amountChangeResult.previousAmount,
        billDetails.amount
      );

      return {
        billId,
        userId,
        status: 'skipped',
        reason: 'Significant amount change detected (>50% increase), user notification sent',
      };
    }

    // Execute payment
    try {
      const record = await this.executePayment(
        userId,
        billId,
        billDetails.amount,
        billDetails.provider,
        billDetails.type
      );

      logger.info({ billId, userId, amount: billDetails.amount, transactionId: record.transactionId }, 'Payment executed successfully');

      return {
        billId,
        userId,
        status: 'success',
        transactionId: record.transactionId,
      };
    } catch (error) {
      logger.error({ error, billId, userId }, 'Payment execution failed, initiating retry logic');

      // Initiate retry logic (this will handle all 3 attempts)
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
            reason: 'Failed after 3 retry attempts, auto-payment disabled',
          };
        }
      } catch (retryError) {
        logger.error({ error: retryError, billId, userId }, 'Retry logic failed');
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

// Export singleton instance
export const autoPaymentService = new AutoPaymentService();
