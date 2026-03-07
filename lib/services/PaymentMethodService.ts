import PaymentMethod, { IPaymentMethod } from '../models/PaymentMethod';
import AutoPaymentConfig from '../models/AutoPaymentConfig';
import connectDB from '../mongoose';
import logger from '../logger';
import { notificationService } from './NotificationService';

/**
 * PaymentMethodService
 * Handles payment method validation and expiry checking
 * Validates: Requirements 1.5, 9.2
 */
export class PaymentMethodService {
  /**
   * Validate that user has a valid (non-expired) payment method
   * Validates: Requirements 1.5, 9.2
   * 
   * @param userId - The user ID to validate
   * @returns The valid payment method
   * @throws Error if no valid payment method exists
   */
  async validatePaymentMethod(userId: string): Promise<IPaymentMethod> {
    try {
      await connectDB();

      // Find user's default payment method
      let paymentMethod = await PaymentMethod.findOne({ 
        userId, 
        isDefault: true 
      });

      // If no default, find any payment method
      if (!paymentMethod) {
        paymentMethod = await PaymentMethod.findOne({ userId });
      }

      if (!paymentMethod) {
        throw new Error('No payment method found for user');
      }

      logger.debug({ 
        userId, 
        paymentMethodId: paymentMethod._id,
        type: paymentMethod.type,
        expiryMonth: paymentMethod.expiryMonth,
        expiryYear: paymentMethod.expiryYear,
        isExpired: paymentMethod.isExpired
      }, 'Found payment method, checking expiry');

      // Check and update expiry status
      try {
        await paymentMethod.checkAndUpdateExpiry();
        
        logger.debug({ 
          userId, 
          paymentMethodId: paymentMethod._id,
          isExpired: paymentMethod.isExpired,
          expiryMonth: paymentMethod.expiryMonth,
          expiryYear: paymentMethod.expiryYear
        }, 'After expiry check');
      } catch (expiryError) {
        logger.error({ error: expiryError, userId, paymentMethodId: paymentMethod._id }, 'Error checking payment method expiry');
        // Continue even if expiry check fails
      }

      if (paymentMethod.isExpired) {
        throw new Error('Payment method has expired');
      }

      logger.debug({ userId, paymentMethodId: paymentMethod._id }, 'Payment method validation passed');

      return paymentMethod;
    } catch (error) {
      logger.error({ 
        error, 
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      }, 'Payment method validation failed');
      throw error;
    }
  }

  /**
   * Check all users for expired payment methods and pause auto-payments
   * Validates: Requirement 9.2
   * 
   * This should be run periodically (e.g., daily) to detect expired payment methods
   * 
   * @returns Array of user IDs with expired payment methods
   */
  async checkAndPauseExpiredPaymentMethods(): Promise<string[]> {
    try {
      await connectDB();

      const affectedUserIds: string[] = [];

      // Find all card payment methods
      const cardPaymentMethods = await PaymentMethod.find({ type: 'card' });

      for (const paymentMethod of cardPaymentMethods) {
        // Check if expired
        const isExpired = await paymentMethod.checkAndUpdateExpiry();

        if (isExpired) {
          const userId = paymentMethod.userId;

          // Check if user has other valid payment methods
          const validPaymentMethod = await PaymentMethod.findOne({
            userId,
            isExpired: false,
            _id: { $ne: paymentMethod._id },
          });

          // If no valid payment method exists, pause all auto-payments
          if (!validPaymentMethod) {
            await this.pauseAllAutoPayments(userId, 'Payment method expired');
            affectedUserIds.push(userId);

            // Send notification to user about payment method expiry
            // Validates: Requirement 9.2
            await notificationService.notifyPaymentMethodExpiry(userId);

            logger.warn({ userId, paymentMethodId: paymentMethod._id }, 'Paused all auto-payments due to expired payment method');
          }
        }
      }

      logger.info({ count: affectedUserIds.length }, 'Completed expired payment method check');

      return affectedUserIds;
    } catch (error) {
      logger.error({ error }, 'Error checking expired payment methods');
      throw error;
    }
  }

  /**
   * Pause all auto-payments for a user
   * Validates: Requirement 9.2
   * 
   * @param userId - The user ID
   * @param reason - Reason for pausing
   */
  async pauseAllAutoPayments(userId: string, reason: string): Promise<void> {
    try {
      await connectDB();

      // Disable all enabled auto-payment configurations
      const result = await AutoPaymentConfig.updateMany(
        { userId, enabled: true },
        { 
          $set: { 
            enabled: false, 
            disabledReason: reason 
          } 
        }
      );

      logger.info({ userId, reason, count: result.modifiedCount }, 'Paused all auto-payments for user');

      // Send notification to user about auto-payments being paused
      // Validates: Requirement 9.4
      await notificationService.notifyAutoPaymentsPaused(userId, reason);
    } catch (error) {
      logger.error({ error, userId }, 'Error pausing auto-payments');
      throw error;
    }
  }

  /**
   * Get user's payment methods
   * 
   * @param userId - The user ID
   * @returns Array of payment methods
   */
  async getUserPaymentMethods(userId: string): Promise<IPaymentMethod[]> {
    try {
      await connectDB();

      const paymentMethods = await PaymentMethod.find({ userId });

      // Update expiry status for all card payment methods
      for (const pm of paymentMethods) {
        if (pm.type === 'card') {
          await pm.checkAndUpdateExpiry();
        }
      }

      return paymentMethods;
    } catch (error) {
      logger.error({ error, userId }, 'Error getting user payment methods');
      throw error;
    }
  }

  /**
   * Add a payment method for a user
   * 
   * @param userId - The user ID
   * @param paymentMethodData - Payment method details
   * @returns The created payment method
   */
  async addPaymentMethod(
    userId: string,
    paymentMethodData: Partial<IPaymentMethod>
  ): Promise<IPaymentMethod> {
    try {
      await connectDB();

      // If this is the first payment method, make it default
      const existingCount = await PaymentMethod.countDocuments({ userId });
      const isDefault = existingCount === 0 || paymentMethodData.isDefault === true;

      // If setting as default, unset other defaults
      if (isDefault) {
        await PaymentMethod.updateMany(
          { userId, isDefault: true },
          { $set: { isDefault: false } }
        );
      }

      const paymentMethod = await PaymentMethod.create({
        ...paymentMethodData,
        userId,
        isDefault,
      });

      logger.info({ userId, paymentMethodId: paymentMethod._id, type: paymentMethod.type }, 'Added payment method');

      return paymentMethod;
    } catch (error) {
      logger.error({ error, userId }, 'Error adding payment method');
      throw error;
    }
  }

  /**
   * Set a payment method as default
   * 
   * @param userId - The user ID
   * @param paymentMethodId - The payment method ID to set as default
   * @returns The updated payment method
   */
  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string
  ): Promise<IPaymentMethod> {
    try {
      await connectDB();

      // Verify payment method belongs to user
      const paymentMethod = await PaymentMethod.findOne({ 
        _id: paymentMethodId, 
        userId 
      });

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      // Check if expired
      await paymentMethod.checkAndUpdateExpiry();
      if (paymentMethod.isExpired) {
        throw new Error('Cannot set expired payment method as default');
      }

      // Unset other defaults
      await PaymentMethod.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } }
      );

      // Set as default
      paymentMethod.isDefault = true;
      await paymentMethod.save();

      logger.info({ userId, paymentMethodId }, 'Set payment method as default');

      return paymentMethod;
    } catch (error) {
      logger.error({ error, userId, paymentMethodId }, 'Error setting default payment method');
      throw error;
    }
  }
}

// Export singleton instance
export const paymentMethodService = new PaymentMethodService();
