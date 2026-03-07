import mongoose, { Schema, Document } from 'mongoose';

/**
 * ManualPayment Model
 * Stores manual "Pay Now" payment records separately from auto-payments
 * Validates: Requirement for separate manual payment tracking
 */

export interface IManualPayment extends Document {
  userId: string;
  billId: string;
  amount: number;
  paymentDate: Date;
  transactionId: string; // Razorpay payment ID
  razorpayOrderId: string;
  razorpayPaymentId: string;
  billProvider: string;
  billType: 'electricity' | 'water' | 'gas' | 'internet' | 'mobile' | 'other';
  status: 'success' | 'failed' | 'pending';
  recordId?: string; // Monthly record ID if paying a specific record
  recordMonth?: string; // Month of the record (YYYY-MM)
  billNumber?: string;
  customerName?: string;
  paymentMethod?: string; // card, upi, netbanking, etc.
  errorMessage?: string; // Error details for failed payments
  metadata?: Record<string, any>; // Additional payment metadata
  createdAt: Date;
  updatedAt: Date;
}

const ManualPaymentSchema = new Schema<IManualPayment>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    billId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentDate: {
      type: Date,
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      required: true,
      index: true,
    },
    billProvider: {
      type: String,
      required: true,
    },
    billType: {
      type: String,
      enum: ['electricity', 'water', 'gas', 'internet', 'mobile', 'other'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      required: true,
      default: 'pending',
      index: true,
    },
    recordId: {
      type: String,
      index: true,
    },
    recordMonth: {
      type: String,
      index: true,
    },
    billNumber: {
      type: String,
    },
    customerName: {
      type: String,
    },
    paymentMethod: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
ManualPaymentSchema.index({ userId: 1, paymentDate: -1 });
ManualPaymentSchema.index({ userId: 1, status: 1, paymentDate: -1 });
ManualPaymentSchema.index({ billId: 1, paymentDate: -1 });
ManualPaymentSchema.index({ userId: 1, billType: 1, paymentDate: -1 });

const ManualPayment = mongoose.models.ManualPayment || mongoose.model<IManualPayment>('ManualPayment', ManualPaymentSchema);

export default ManualPayment;
