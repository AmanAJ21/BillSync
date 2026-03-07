import AuditLog, { IAuditLog } from '../models/AuditLog';
import connectDB from '../mongoose';
import logger from '../logger';

/**
 * AuditLogService
 * Handles audit logging for all payment operations
 * Validates: Requirement 9.5
 */

export interface AuditLogEntry {
  userId: string;
  adminId?: string; // Admin user ID who performed action (for admin operations)
  operation: string;
  operationType: IAuditLog['operationType'];
  entityType: IAuditLog['entityType'];
  entityId?: string;
  targetUserId?: string; // User affected by admin action
  details: Record<string, any>;
  beforeState?: Record<string, any>; // State before admin operation
  afterState?: Record<string, any>; // State after admin operation
  status: 'success' | 'failure' | 'pending';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogService {
  /**
   * Log an audit entry
   * Validates: Requirement 9.5
   * 
   * @param entry - Audit log entry details
   * @returns The created audit log
   */
  async log(entry: AuditLogEntry): Promise<IAuditLog> {
    try {
      await connectDB();

      const auditLog = await AuditLog.create({
        ...entry,
        timestamp: new Date(),
      });

      logger.info(
        {
          auditLogId: auditLog._id,
          userId: entry.userId,
          operation: entry.operation,
          operationType: entry.operationType,
          status: entry.status,
        },
        'Audit log created'
      );

      return auditLog;
    } catch (error) {
      // Don't throw error for audit log failures - log and continue
      logger.error({ error, entry }, 'Error creating audit log');
      // Return a minimal fallback so callers don't break
      return { _id: 'audit-log-failed', ...entry, timestamp: new Date() } as any;
    }
  }

  /**
   * Log auto-payment enable operation
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param configId - AutoPaymentConfig ID
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logAutoPaymentEnable(
    userId: string,
    billId: string,
    configId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId,
        operation: 'Enable automatic payment',
        operationType: 'auto_payment_enable',
        entityType: 'auto_payment_config',
        entityId: configId,
        details: { billId },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      // Don't throw - audit logging should not break the main flow
      logger.error({ error, userId, billId }, 'Failed to log auto-payment enable');
    }
  }

  /**
   * Log auto-payment disable operation
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param configId - AutoPaymentConfig ID
   * @param reason - Reason for disabling
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logAutoPaymentDisable(
    userId: string,
    billId: string,
    configId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId,
        operation: 'Disable automatic payment',
        operationType: 'auto_payment_disable',
        entityType: 'auto_payment_config',
        entityId: configId,
        details: { billId, reason },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, userId, billId }, 'Failed to log auto-payment disable');
    }
  }

  /**
   * Log payment attempt
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param amount - Payment amount
   * @param attemptNumber - Attempt number
   */
  async logPaymentAttempt(
    userId: string,
    billId: string,
    amount: number,
    attemptNumber: number = 1
  ): Promise<void> {
    try {
      await this.log({
        userId,
        operation: 'Payment attempt',
        operationType: 'payment_attempt',
        entityType: 'auto_payment_record',
        details: { billId, amount, attemptNumber },
        status: 'pending',
      });
    } catch (error) {
      logger.error({ error, userId, billId }, 'Failed to log payment attempt');
    }
  }

  /**
   * Log payment success
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param amount - Payment amount
   * @param transactionId - Transaction ID
   * @param recordId - AutoPaymentRecord ID
   */
  async logPaymentSuccess(
    userId: string,
    billId: string,
    amount: number,
    transactionId: string,
    recordId: string
  ): Promise<void> {
    try {
      await this.log({
        userId,
        operation: 'Payment success',
        operationType: 'payment_success',
        entityType: 'auto_payment_record',
        entityId: recordId,
        details: { billId, amount, transactionId },
        status: 'success',
      });
    } catch (error) {
      logger.error({ error, userId, billId }, 'Failed to log payment success');
    }
  }

  /**
   * Log payment failure
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param amount - Payment amount
   * @param errorMessage - Error message
   * @param attemptNumber - Attempt number
   */
  async logPaymentFailure(
    userId: string,
    billId: string,
    amount: number,
    errorMessage: string,
    attemptNumber: number = 1
  ): Promise<void> {
    try {
      await this.log({
        userId,
        operation: 'Payment failure',
        operationType: 'payment_failure',
        entityType: 'auto_payment_record',
        details: { billId, amount, attemptNumber },
        status: 'failure',
        errorMessage,
      });
    } catch (error) {
      logger.error({ error, userId, billId }, 'Failed to log payment failure');
    }
  }

  /**
   * Log payment retry
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param amount - Payment amount
   * @param attemptNumber - Attempt number
   */
  async logPaymentRetry(
    userId: string,
    billId: string,
    amount: number,
    attemptNumber: number
  ): Promise<void> {
    try {
      await this.log({
        userId,
        operation: 'Payment retry',
        operationType: 'payment_retry',
        entityType: 'auto_payment_record',
        details: { billId, amount, attemptNumber },
        status: 'pending',
      });
    } catch (error) {
      logger.error({ error, userId, billId }, 'Failed to log payment retry');
    }
  }

  /**
   * Log consolidated bill payment
   * 
   * @param userId - User ID
   * @param consolidatedBillId - Consolidated bill ID
   * @param amount - Payment amount
   * @param status - Payment status
   * @param razorpayOrderId - Razorpay order ID
   * @param errorMessage - Optional error message
   */
  async logConsolidatedBillPayment(
    userId: string,
    consolidatedBillId: string,
    amount: number,
    status: 'success' | 'failure',
    razorpayOrderId?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.log({
        userId,
        operation: 'Consolidated bill payment',
        operationType: 'consolidated_bill_payment',
        entityType: 'consolidated_bill',
        entityId: consolidatedBillId,
        details: { amount, razorpayOrderId },
        status,
        errorMessage,
      });
    } catch (error) {
      logger.error({ error, userId, consolidatedBillId }, 'Failed to log consolidated bill payment');
    }
  }

  /**
   * Log payment method expiry
   * 
   * @param userId - User ID
   * @param paymentMethodId - Payment method ID
   */
  async logPaymentMethodExpired(
    userId: string,
    paymentMethodId: string
  ): Promise<void> {
    try {
      await this.log({
        userId,
        operation: 'Payment method expired',
        operationType: 'payment_method_expired',
        entityType: 'payment_method',
        entityId: paymentMethodId,
        details: { paymentMethodId },
        status: 'success',
      });
    } catch (error) {
      logger.error({ error, userId, paymentMethodId }, 'Failed to log payment method expiry');
    }
  }

  /**
   * Log bill record creation
   * 
   * @param adminId - Admin user ID
   * @param billId - Bill ID
   * @param recordId - Record ID
   * @param recordData - Record data
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logBillRecordCreate(
    adminId: string,
    billId: string,
    recordId: string,
    recordData: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: 'Create bill record',
        operationType: 'bill_record_create',
        entityType: 'bill_record',
        entityId: recordId,
        details: { billId, ...recordData },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, billId, recordId }, 'Failed to log bill record creation');
    }
  }

  /**
   * Log bill record update
   * 
   * @param adminId - Admin user ID
   * @param billId - Bill ID
   * @param recordId - Record ID
   * @param beforeState - State before update
   * @param afterState - State after update
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logBillRecordUpdate(
    adminId: string,
    billId: string,
    recordId: string,
    beforeState: Record<string, any>,
    afterState: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: 'Update bill record',
        operationType: 'bill_record_update',
        entityType: 'bill_record',
        entityId: recordId,
        beforeState,
        afterState,
        details: { billId },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, billId, recordId }, 'Failed to log bill record update');
    }
  }

  /**
   * Log bill record deletion
   * 
   * @param adminId - Admin user ID
   * @param billId - Bill ID
   * @param recordId - Record ID
   * @param recordData - Record data before deletion
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logBillRecordDelete(
    adminId: string,
    billId: string,
    recordId: string,
    recordData: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: 'Delete bill record',
        operationType: 'bill_record_delete',
        entityType: 'bill_record',
        entityId: recordId,
        beforeState: recordData,
        afterState: { deleted: true },
        details: { billId },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, billId, recordId }, 'Failed to log bill record deletion');
    }
  }

  /**
   * Log transaction update
   * 
   * @param adminId - Admin user ID
   * @param transactionId - Transaction ID
   * @param beforeState - State before update
   * @param afterState - State after update
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logTransactionUpdate(
    adminId: string,
    transactionId: string,
    beforeState: Record<string, any>,
    afterState: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: 'Update transaction',
        operationType: 'transaction_update',
        entityType: 'transaction',
        entityId: transactionId,
        beforeState,
        afterState,
        details: { transactionId },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, transactionId }, 'Failed to log transaction update');
    }
  }

  /**
   * Log transaction deletion
   * 
   * @param adminId - Admin user ID
   * @param transactionId - Transaction ID
   * @param transactionData - Transaction data before deletion
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logTransactionDelete(
    adminId: string,
    transactionId: string,
    transactionData: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: 'Delete transaction',
        operationType: 'transaction_delete',
        entityType: 'transaction',
        entityId: transactionId,
        beforeState: transactionData,
        afterState: { deleted: true },
        details: { transactionId },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, transactionId }, 'Failed to log transaction deletion');
    }
  }

  /**
   * Log transaction status change
   * 
   * @param adminId - Admin user ID
   * @param transactionId - Transaction ID
   * @param oldStatus - Old status
   * @param newStatus - New status
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logTransactionStatusChange(
    adminId: string,
    transactionId: string,
    oldStatus: string,
    newStatus: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: 'Change transaction status',
        operationType: 'transaction_status_change',
        entityType: 'transaction',
        entityId: transactionId,
        beforeState: { status: oldStatus },
        afterState: { status: newStatus },
        details: { transactionId, oldStatus, newStatus },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, transactionId }, 'Failed to log transaction status change');
    }
  }

  /**
   * Log config creation
   * 
   * @param adminId - Admin user ID
   * @param configKey - Config key
   * @param configValue - Config value
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logConfigCreate(
    adminId: string,
    configKey: string,
    configValue: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: 'Create config',
        operationType: 'config_create',
        entityType: 'system_config',
        entityId: configKey,
        afterState: { value: configValue },
        details: { key: configKey },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, configKey }, 'Failed to log config creation');
    }
  }

  /**
   * Log config update
   * 
   * @param adminId - Admin user ID
   * @param configKey - Config key
   * @param oldValue - Old value
   * @param newValue - New value
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logConfigUpdate(
    adminId: string,
    configKey: string,
    oldValue: any,
    newValue: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: 'Update config',
        operationType: 'config_update',
        entityType: 'system_config',
        entityId: configKey,
        beforeState: { value: oldValue },
        afterState: { value: newValue },
        details: { key: configKey },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, configKey }, 'Failed to log config update');
    }
  }

  /**
   * Log config deletion
   * 
   * @param adminId - Admin user ID
   * @param configKey - Config key
   * @param configValue - Config value before deletion
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logConfigDelete(
    adminId: string,
    configKey: string,
    configValue: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: 'Delete config',
        operationType: 'config_delete',
        entityType: 'system_config',
        entityId: configKey,
        beforeState: { value: configValue },
        afterState: { deleted: true },
        details: { key: configKey },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, configKey }, 'Failed to log config deletion');
    }
  }

  /**
   * Log data export
   * 
   * @param adminId - Admin user ID
   * @param exportType - Type of data exported (users, bills, transactions)
   * @param filters - Filters applied to export
   * @param recordCount - Number of records exported
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   */
  async logDataExport(
    adminId: string,
    exportType: 'users' | 'bills' | 'transactions',
    filters: Record<string, any>,
    recordCount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.log({
        userId: adminId,
        adminId,
        operation: `Export ${exportType}`,
        operationType: 'data_export',
        entityType: 'system_config',
        details: { exportType, filters, recordCount },
        status: 'success',
        ipAddress,
        userAgent,
      });
    } catch (error) {
      logger.error({ error, adminId, exportType }, 'Failed to log data export');
    }
  }

  /**
   * Get audit logs for a user
   * 
   * @param userId - User ID
   * @param options - Query options
   * @returns Array of audit logs
   */
  async getUserAuditLogs(
    userId: string,
    options?: {
      operationType?: IAuditLog['operationType'];
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      skip?: number;
    }
  ): Promise<IAuditLog[]> {
    try {
      await connectDB();

      const query: any = { userId };

      if (options?.operationType) {
        query.operationType = options.operationType;
      }

      if (options?.startDate || options?.endDate) {
        query.timestamp = {};
        if (options.startDate) {
          query.timestamp.$gte = options.startDate;
        }
        if (options.endDate) {
          query.timestamp.$lte = options.endDate;
        }
      }

      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(options?.limit || 100)
        .skip(options?.skip || 0);

      return logs;
    } catch (error) {
      logger.error({ error, userId }, 'Error getting user audit logs');
      throw error;
    }
  }

  /**
   * Get audit logs for an entity
   * 
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @returns Array of audit logs
   */
  async getEntityAuditLogs(
    entityType: IAuditLog['entityType'],
    entityId: string
  ): Promise<IAuditLog[]> {
    try {
      await connectDB();

      const logs = await AuditLog.find({ entityType, entityId })
        .sort({ timestamp: -1 })
        .limit(100);

      return logs;
    } catch (error) {
      logger.error({ error, entityType, entityId }, 'Error getting entity audit logs');
      throw error;
    }
  }
}

// Export singleton instance
export const auditLogService = new AuditLogService();
