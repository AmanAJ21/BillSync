import logger from '../logger';

/**
 * NotificationService
 * Handles sending notifications to users for various events
 * Validates: Requirements 2.5, 5.1, 9.1, 9.2, 9.4
 */

export type NotificationType =
  | 'payment_success'
  | 'payment_failed_final'
  | 'payment_retry'
  | 'amount_change'
  | 'consolidated_bill_generated'
  | 'payment_method_expiry'
  | 'auto_payments_paused';

export interface NotificationData {
  billId?: string;
  amount?: number;
  transactionId?: string;
  consolidatedBillId?: string;
  reason?: string;
  attemptNumber?: number;
  previousAmount?: number;
  newAmount?: number;
  [key: string]: any;
}

export class NotificationService {
  /**
   * Send notification to user
   * Validates: Requirements 2.5, 5.1, 9.1, 9.2, 9.4
   * 
   * @param userId - The user ID to send notification to
   * @param type - Type of notification
   * @param data - Additional data for the notification
   * @returns Promise that resolves when notification is sent
   */
  async sendNotification(
    userId: string,
    type: NotificationType,
    data: NotificationData = {}
  ): Promise<void> {
    try {
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (!type) {
        throw new Error('Notification type is required');
      }

      // Log the notification
      logger.info({ userId, type, data }, 'Sending notification');

      // In a real implementation, this would integrate with:
      // 1. Email service (e.g., SendGrid, AWS SES)
      // 2. SMS service (e.g., Twilio)
      // 3. Push notification service (e.g., Firebase Cloud Messaging)
      // 4. In-app notification system

      // For now, we'll simulate the notification by logging
      const message = this.formatNotificationMessage(type, data);
      logger.info({ userId, type, message }, 'Notification sent successfully');

      // Simulate async notification delivery
      await this.deliverNotification(userId, type, message, data);
    } catch (error) {
      // Don't throw error for notification failures - log and continue
      // This ensures that notification failures don't break the main flow
      logger.error({ error, userId, type }, 'Error sending notification');
    }
  }

  /**
   * Format notification message based on type and data
   * 
   * @param type - Notification type
   * @param data - Notification data
   * @returns Formatted message string
   */
  private formatNotificationMessage(
    type: NotificationType,
    data: NotificationData
  ): string {
    switch (type) {
      case 'payment_success':
        return `Payment successful for bill ${data.billId}. Amount: $${data.amount}. Transaction ID: ${data.transactionId}`;

      case 'payment_failed_final':
        return `Payment failed for bill ${data.billId} after 3 retry attempts. Amount: $${data.amount}. Automatic payment has been disabled. Please update your payment method and try again.`;

      case 'payment_retry':
        return `Payment retry attempt ${data.attemptNumber} for bill ${data.billId}. Amount: $${data.amount}. We'll continue trying to process your payment.`;

      case 'amount_change':
        return `Significant amount change detected for bill ${data.billId}. Previous: $${data.previousAmount}, New: $${data.newAmount}. Please review and confirm before automatic payment proceeds.`;

      case 'consolidated_bill_generated':
        return `Your consolidated bill for the payment cycle has been generated. Total amount: $${data.amount}. Consolidated Bill ID: ${data.consolidatedBillId}. Please review and pay at your convenience.`;

      case 'payment_method_expiry':
        return `Your payment method has expired. Please update your payment method to continue automatic payments.`;

      case 'auto_payments_paused':
        return `All automatic payments have been paused. Reason: ${data.reason}. Please take action to resume automatic payments.`;

      default:
        return `Notification: ${type}`;
    }
  }

  /**
   * Deliver notification through various channels
   * This is a placeholder for actual delivery implementation
   * 
   * @param userId - User ID
   * @param type - Notification type
   * @param message - Formatted message
   * @param data - Additional data
   */
  private async deliverNotification(
    userId: string,
    type: NotificationType,
    message: string,
    data: NotificationData
  ): Promise<void> {
    // Simulate async delivery
    await new Promise((resolve) => setTimeout(resolve, 10));

    // In a real implementation, this would:
    // 1. Look up user's notification preferences
    // 2. Send email if user has email notifications enabled
    // 3. Send SMS if user has SMS notifications enabled
    // 4. Send push notification if user has push enabled
    // 5. Create in-app notification record

    // Example implementations:
    // await this.sendEmail(userId, type, message, data);
    // await this.sendSMS(userId, type, message, data);
    // await this.sendPushNotification(userId, type, message, data);
    // await this.createInAppNotification(userId, type, message, data);
  }

  /**
   * Send notification for payment success
   * Validates: Requirement 2.5
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param amount - Payment amount
   * @param transactionId - Transaction ID
   */
  async notifyPaymentSuccess(
    userId: string,
    billId: string,
    amount: number,
    transactionId: string
  ): Promise<void> {
    await this.sendNotification(userId, 'payment_success', {
      billId,
      amount,
      transactionId,
    });
  }

  /**
   * Send notification for payment failure after all retries
   * Validates: Requirement 2.5
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param amount - Payment amount
   */
  async notifyPaymentFailedFinal(
    userId: string,
    billId: string,
    amount: number
  ): Promise<void> {
    await this.sendNotification(userId, 'payment_failed_final', {
      billId,
      amount,
    });
  }

  /**
   * Send notification for payment retry
   * Validates: Requirement 2.5
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param amount - Payment amount
   * @param attemptNumber - Retry attempt number
   */
  async notifyPaymentRetry(
    userId: string,
    billId: string,
    amount: number,
    attemptNumber: number
  ): Promise<void> {
    await this.sendNotification(userId, 'payment_retry', {
      billId,
      amount,
      attemptNumber,
    });
  }

  /**
   * Send notification for significant amount change
   * Validates: Requirement 9.1
   * 
   * @param userId - User ID
   * @param billId - Bill ID
   * @param previousAmount - Previous bill amount
   * @param newAmount - New bill amount
   */
  async notifyAmountChange(
    userId: string,
    billId: string,
    previousAmount: number,
    newAmount: number
  ): Promise<void> {
    await this.sendNotification(userId, 'amount_change', {
      billId,
      previousAmount,
      newAmount,
    });
  }

  /**
   * Send notification for consolidated bill generation
   * Validates: Requirement 5.1
   * 
   * @param userId - User ID
   * @param consolidatedBillId - Consolidated bill ID
   * @param amount - Total amount
   */
  async notifyConsolidatedBillGenerated(
    userId: string,
    consolidatedBillId: string,
    amount: number
  ): Promise<void> {
    await this.sendNotification(userId, 'consolidated_bill_generated', {
      consolidatedBillId,
      amount,
    });
  }

  /**
   * Send notification for payment method expiry
   * Validates: Requirement 9.2
   * 
   * @param userId - User ID
   */
  async notifyPaymentMethodExpiry(userId: string): Promise<void> {
    await this.sendNotification(userId, 'payment_method_expiry', {});
  }

  /**
   * Send notification for auto-payments paused
   * Validates: Requirement 9.4
   * 
   * @param userId - User ID
   * @param reason - Reason for pausing
   */
  async notifyAutoPaymentsPaused(
    userId: string,
    reason: string
  ): Promise<void> {
    await this.sendNotification(userId, 'auto_payments_paused', {
      reason,
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
