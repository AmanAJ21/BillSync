import mongoose, { Schema, Document } from 'mongoose';

/**
 * AuditLog Model
 * Stores audit logs for all payment operations
 * Validates: Requirement 9.5
 */

export interface IAuditLog extends Document {
  userId: string;
  adminId?: string; // Admin user ID who performed action (for admin operations)
  operation: string;
  operationType:
  | 'auto_payment_enable'
  | 'auto_payment_disable'
  | 'payment_attempt'
  | 'payment_success'
  | 'payment_failure'
  | 'payment_retry'
  | 'manual_payment_success'
  | 'manual_payment_failure'
  | 'consolidated_bill_payment'
  | 'payment_method_update'
  | 'payment_method_expired'
  | 'bill_create'
  | 'bill_update'
  | 'bill_delete'
  | 'bill_bulk_update'
  | 'bill_bulk_delete'
  | 'bill_record_create'
  | 'bill_record_update'
  | 'bill_record_delete'
  | 'user_role_change'
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'config_update'
  | 'config_create'
  | 'config_delete'
  | 'data_export'
  | 'transaction_update'
  | 'transaction_delete'
  | 'transaction_status_change';
  entityType: 'auto_payment_config' | 'auto_payment_record' | 'consolidated_bill' | 'payment_method' | 'bill' | 'bill_record' | 'user' | 'system_config' | 'transaction';
  entityId?: string;
  targetUserId?: string; // User affected by admin action
  details: Record<string, any>;
  beforeState?: Record<string, any>; // State before admin operation
  afterState?: Record<string, any>; // State after admin operation
  status: 'success' | 'failure' | 'pending';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    adminId: {
      type: String,
      index: true,
    },
    operation: {
      type: String,
      required: true,
      index: true,
    },
    operationType: {
      type: String,
      enum: [
        'auto_payment_enable',
        'auto_payment_disable',
        'payment_attempt',
        'payment_success',
        'payment_failure',
        'payment_retry',
        'manual_payment_success',
        'manual_payment_failure',
        'consolidated_bill_payment',
        'payment_method_update',
        'payment_method_expired',
        'bill_create',
        'bill_update',
        'bill_delete',
        'bill_bulk_update',
        'bill_bulk_delete',
        'bill_record_create',
        'bill_record_update',
        'bill_record_delete',
        'user_role_change',
        'user_create',
        'user_update',
        'user_delete',
        'config_update',
        'config_create',
        'config_delete',
        'data_export',
        'transaction_update',
        'transaction_delete',
        'transaction_status_change',
      ],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['auto_payment_config', 'auto_payment_record', 'consolidated_bill', 'payment_method', 'bill', 'bill_record', 'user', 'system_config', 'transaction'],
      required: true,
    },
    entityId: {
      type: String,
      index: true,
    },
    targetUserId: {
      type: String,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      required: true,
    },
    beforeState: {
      type: Schema.Types.Mixed,
    },
    afterState: {
      type: Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['success', 'failure', 'pending'],
      required: true,
      index: true,
    },
    errorMessage: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We use our own timestamp field
  }
);

// Compound indexes for common queries
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, operationType: 1, timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
// Admin-specific compound indexes
AuditLogSchema.index({ adminId: 1, timestamp: -1 });
AuditLogSchema.index({ adminId: 1, operationType: 1, timestamp: -1 });
AuditLogSchema.index({ targetUserId: 1, timestamp: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
