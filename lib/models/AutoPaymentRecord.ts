import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * AutoPaymentRecord Interface
 * Records each automatic payment execution
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5
 */
export interface IAutoPaymentRecord extends Document {
  userId: string;
  billId: string;
  amount: number;
  paymentDate: Date;
  transactionId: string;
  billProvider: string;
  billType: string;
  status: 'success' | 'failed' | 'settled';
  paymentCycleId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  recordMonth?: string;
  billNumber?: string;
  customerName?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Status enum for validation
export const AutoPaymentRecordStatus = {
  SUCCESS: 'success' as const,
  FAILED: 'failed' as const,
  SETTLED: 'settled' as const,
};

const AutoPaymentRecordSchema = new Schema<IAutoPaymentRecord>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      trim: true,
      index: true,
    },
    billId: {
      type: String,
      required: [true, 'Bill ID is required'],
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      index: true,
    },
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      unique: true,
      trim: true,
    },
    billProvider: {
      type: String,
      required: [true, 'Bill provider is required'],
      trim: true,
    },
    billType: {
      type: String,
      required: [true, 'Bill type is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['success', 'failed', 'settled'],
        message: '{VALUE} is not a valid status',
      },
      required: true,
      default: 'success',
    },
    paymentCycleId: {
      type: String,
      required: [true, 'Payment cycle ID is required'],
      trim: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    recordMonth: {
      type: String,
      trim: true,
    },
    billNumber: {
      type: String,
      trim: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
AutoPaymentRecordSchema.index({ userId: 1, paymentCycleId: 1 });
AutoPaymentRecordSchema.index({ userId: 1, paymentDate: -1 });
AutoPaymentRecordSchema.index({ userId: 1, status: 1 });

// Unique compound index to prevent duplicate successful payments per bill per cycle
// This enforces Property 7: No Duplicate Payments
AutoPaymentRecordSchema.index(
  { userId: 1, billId: 1, paymentCycleId: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: { $in: ['success', 'settled'] } },
    name: 'unique_successful_payment_per_bill_per_cycle'
  }
);

// Instance method to mark as settled
AutoPaymentRecordSchema.methods.markAsSettled = function() {
  this.status = AutoPaymentRecordStatus.SETTLED;
  return this.save();
};

// Static method to find records by payment cycle
AutoPaymentRecordSchema.statics.findByPaymentCycle = function(userId: string, paymentCycleId: string) {
  return this.find({ userId, paymentCycleId, status: { $ne: 'failed' } });
};

const AutoPaymentRecord: Model<IAutoPaymentRecord> =
  mongoose.models.AutoPaymentRecord ||
  mongoose.model<IAutoPaymentRecord>('AutoPaymentRecord', AutoPaymentRecordSchema);

export default AutoPaymentRecord;
