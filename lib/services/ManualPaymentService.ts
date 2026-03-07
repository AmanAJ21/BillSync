import ManualPayment, { IManualPayment } from '../models/ManualPayment';
import connectDB from '../mongoose';
import logger from '../logger';
import { auditLogService } from './AuditLogService';

/**
 * ManualPaymentService
 * Handles manual "Pay Now" payment operations
 */

export interface CreateManualPaymentParams {
  userId: string;
  billId: string;
  amount: number;
  transactionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  billProvider: string;
  billType: 'electricity' | 'water' | 'gas' | 'internet' | 'mobile' | 'other';
  recordId?: string;
  recordMonth?: string;
  billNumber?: string;
  customerName?: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

export interface ManualPaymentFilters {
  userId?: string;
  billId?: string;
  status?: 'success' | 'failed' | 'pending';
  billType?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginatedManualPayments {
  payments: IManualPayment[];
  total: number;
  page: number;
  totalPages: number;
}

export class ManualPaymentService {
  /**
   * Create a manual payment record
   * 
   * @param params - Payment details
   * @returns Created payment record
   */
  async createPayment(params: CreateManualPaymentParams): Promise<IManualPayment> {
    try {
      await connectDB();

      const payment = await ManualPayment.create({
        userId: params.userId,
        billId: params.billId,
        amount: params.amount,
        paymentDate: new Date(),
        transactionId: params.transactionId,
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        billProvider: params.billProvider,
        billType: params.billType,
        status: 'success',
        recordId: params.recordId,
        recordMonth: params.recordMonth,
        billNumber: params.billNumber,
        customerName: params.customerName,
        paymentMethod: params.paymentMethod,
        metadata: params.metadata,
      });

      logger.info(
        {
          paymentId: payment._id,
          userId: params.userId,
          billId: params.billId,
          amount: params.amount,
          transactionId: params.transactionId,
        },
        'Manual payment created'
      );

      // Log audit event
      await auditLogService.log({
        userId: params.userId,
        operation: 'Manual payment',
        operationType: 'manual_payment_success',
        entityType: 'bill',
        entityId: params.billId,
        details: {
          amount: params.amount,
          transactionId: params.transactionId,
          billProvider: params.billProvider,
          billType: params.billType,
          recordMonth: params.recordMonth,
        },
        status: 'success',
      });

      return payment;
    } catch (error) {
      logger.error({ error, params }, 'Error creating manual payment');
      throw error;
    }
  }

  /**
   * Record a failed manual payment attempt
   * 
   * @param params - Payment details
   * @param errorMessage - Error message
   * @returns Created payment record
   */
  async recordFailedPayment(
    params: CreateManualPaymentParams,
    errorMessage: string
  ): Promise<IManualPayment> {
    try {
      await connectDB();

      const payment = await ManualPayment.create({
        userId: params.userId,
        billId: params.billId,
        amount: params.amount,
        paymentDate: new Date(),
        transactionId: params.transactionId,
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        billProvider: params.billProvider,
        billType: params.billType,
        status: 'failed',
        recordId: params.recordId,
        recordMonth: params.recordMonth,
        billNumber: params.billNumber,
        customerName: params.customerName,
        errorMessage: errorMessage,
        metadata: params.metadata,
      });

      logger.warn(
        {
          paymentId: payment._id,
          userId: params.userId,
          billId: params.billId,
          errorMessage,
        },
        'Manual payment failed'
      );

      // Log audit event
      await auditLogService.log({
        userId: params.userId,
        operation: 'Manual payment failed',
        operationType: 'manual_payment_failure',
        entityType: 'bill',
        entityId: params.billId,
        details: {
          amount: params.amount,
          transactionId: params.transactionId,
          billProvider: params.billProvider,
          billType: params.billType,
        },
        status: 'failure',
        errorMessage,
      });

      return payment;
    } catch (error) {
      logger.error({ error, params }, 'Error recording failed payment');
      throw error;
    }
  }

  /**
   * Get manual payments with filters and pagination
   * 
   * @param filters - Filter criteria
   * @param page - Page number
   * @param limit - Records per page
   * @returns Paginated payment records
   */
  async getPayments(
    filters: ManualPaymentFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedManualPayments> {
    try {
      await connectDB();

      // Build query
      const query: any = {};

      if (filters.userId) {
        query.userId = filters.userId;
      }

      if (filters.billId) {
        query.billId = filters.billId;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.billType) {
        query.billType = filters.billType;
      }

      if (filters.startDate || filters.endDate) {
        query.paymentDate = {};
        if (filters.startDate) {
          query.paymentDate.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.paymentDate.$lte = filters.endDate;
        }
      }

      // Calculate skip
      const skip = (page - 1) * limit;

      // Execute query
      const [payments, total] = await Promise.all([
        ManualPayment.find(query)
          .sort({ paymentDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ManualPayment.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        payments: payments as IManualPayment[],
        total,
        page,
        totalPages,
      };
    } catch (error) {
      logger.error({ error, filters }, 'Error getting manual payments');
      throw error;
    }
  }

  /**
   * Get a single payment by transaction ID
   * 
   * @param transactionId - Razorpay payment ID
   * @returns Payment record or null
   */
  async getPaymentByTransactionId(transactionId: string): Promise<IManualPayment | null> {
    try {
      await connectDB();

      const payment = await ManualPayment.findOne({ transactionId }).lean();
      return payment as IManualPayment | null;
    } catch (error) {
      logger.error({ error, transactionId }, 'Error getting payment by transaction ID');
      throw error;
    }
  }

  /**
   * Get payment statistics for a user
   * 
   * @param userId - User ID
   * @returns Payment statistics
   */
  async getUserPaymentStats(userId: string): Promise<{
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalAmount: number;
    averageAmount: number;
  }> {
    try {
      await connectDB();

      const stats = await ManualPayment.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            successfulPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
            },
            failedPayments: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
            },
            totalAmount: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0] },
            },
          },
        },
      ]);

      if (stats.length === 0) {
        return {
          totalPayments: 0,
          successfulPayments: 0,
          failedPayments: 0,
          totalAmount: 0,
          averageAmount: 0,
        };
      }

      const result = stats[0];
      return {
        totalPayments: result.totalPayments,
        successfulPayments: result.successfulPayments,
        failedPayments: result.failedPayments,
        totalAmount: result.totalAmount,
        averageAmount: result.successfulPayments > 0 
          ? result.totalAmount / result.successfulPayments 
          : 0,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Error getting user payment stats');
      throw error;
    }
  }

  /**
   * Get payment history for a specific bill
   * 
   * @param billId - Bill ID
   * @returns Array of payment records
   */
  async getBillPaymentHistory(billId: string): Promise<IManualPayment[]> {
    try {
      await connectDB();

      const payments = await ManualPayment.find({ billId })
        .sort({ paymentDate: -1 })
        .lean();

      return payments as IManualPayment[];
    } catch (error) {
      logger.error({ error, billId }, 'Error getting bill payment history');
      throw error;
    }
  }
}

// Export singleton instance
export const manualPaymentService = new ManualPaymentService();
