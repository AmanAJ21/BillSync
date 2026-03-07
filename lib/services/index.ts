/**
 * Central service integration file
 * Wires all services together and exports them for use throughout the application
 * Validates: All requirements
 */

// Core services
export { autoPaymentService, AutoPaymentService } from './AutoPaymentService';
export { autoPaymentRecordService, AutoPaymentRecordService } from './AutoPaymentRecordService';
export { aggregationEngine, AggregationEngine } from './AggregationEngine';
export { paymentCycleService, PaymentCycleService } from './PaymentCycleService';
export { notificationService, NotificationService } from './NotificationService';
export { analyticsService, AnalyticsService } from './AnalyticsService';
export { auditLogService, AuditLogService } from './AuditLogService';
export { paymentMethodService, PaymentMethodService } from './PaymentMethodService';
export { consolidatedBillHistoryService, ConsolidatedBillHistoryService } from './ConsolidatedBillHistoryService';

// Admin services
export { adminUserService, AdminUserService } from './AdminUserService';
export { adminBillService, AdminBillService } from './AdminBillService';

// Payment processing
export {
  payConsolidatedBill,
  handlePaymentSuccess,
  handlePaymentFailure
} from './ConsolidatedBillPaymentService';

// PDF generation
export { PDFGenerationService } from './PDFGenerationService';

// BillAPI client
export { BillAPIClient, BillAPIError } from './BillAPIClient';


/**
 * Service Integration Notes:
 * 
 * 1. AutoPaymentService → PaymentProcessor
 *    - AutoPaymentService manages configuration
 *    - PaymentProcessor executes payments using configs
 * 
 * 2. PaymentProcessor → NotificationService
 *    - PaymentProcessor sends notifications on success/failure
 *    - PaymentProcessor sends notifications on amount changes
 * 
 * 3. AggregationEngine → PaymentCycleService
 *    - AggregationEngine generates bills at cycle end
 *    - PaymentCycleService manages cycle transitions
 * 
 * 4. ConsolidatedBillPaymentService → NotificationService
 *    - Payment service notifies users of payment status
 * 
 * 5. All services → AuditLogService
 *    - All payment operations are logged for audit
 * 
 * 6. PaymentMethodService → AutoPaymentService
 *    - Payment method validation before enabling auto-payment
 *    - Payment method expiry handling pauses auto-payments
 */
