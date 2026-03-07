import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * ConsolidatedBill Interface
 * Represents an aggregated bill for a payment cycle
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */
export interface IConsolidatedBill extends Document {
  userId: string;
  paymentCycleId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  totalAmount: number;
  autoPaymentRecords: string[];
  status: 'pending' | 'paid' | 'failed';
  paidAt?: Date;
  razorpayOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
  // Virtual property
  isPaid: boolean;
}

// Status enum for validation
export const ConsolidatedBillStatus = {
  PENDING: 'pending' as const,
  PAID: 'paid' as const,
  FAILED: 'failed' as const,
};

const ConsolidatedBillSchema = new Schema<IConsolidatedBill>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      trim: true,
      index: true,
    },
    paymentCycleId: {
      type: String,
      required: [true, 'Payment cycle ID is required'],
      trim: true,
      index: true,
    },
    cycleStartDate: {
      type: Date,
      required: [true, 'Cycle start date is required'],
    },
    cycleEndDate: {
      type: Date,
      required: [true, 'Cycle end date is required'],
      validate: {
        validator: function(value: Date) {
          return value > (this as any).cycleStartDate;
        },
        message: 'Cycle end date must be after start date',
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount must be positive'],
    },
    autoPaymentRecords: {
      type: [String],
      required: true,
      default: [],
      validate: {
        validator: function(value: string[]) {
          return value.length > 0;
        },
        message: 'Consolidated bill must have at least one payment record',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'paid', 'failed'],
        message: '{VALUE} is not a valid status',
      },
      required: true,
      default: 'pending',
    },
    paidAt: {
      type: Date,
      required: false,
    },
    razorpayOrderId: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient queries
ConsolidatedBillSchema.index({ userId: 1, createdAt: -1 });
ConsolidatedBillSchema.index({ userId: 1, paymentCycleId: 1 }, { unique: true });
ConsolidatedBillSchema.index({ userId: 1, status: 1 });

// Virtual property to check if bill is paid
ConsolidatedBillSchema.virtual('isPaid').get(function() {
  return this.status === ConsolidatedBillStatus.PAID;
});

// Instance method to mark as paid
ConsolidatedBillSchema.methods.markAsPaid = function(razorpayOrderId: string) {
  this.status = ConsolidatedBillStatus.PAID;
  this.paidAt = new Date();
  this.razorpayOrderId = razorpayOrderId;
  return this.save();
};

// Instance method to mark as failed
ConsolidatedBillSchema.methods.markAsFailed = function() {
  this.status = ConsolidatedBillStatus.FAILED;
  return this.save();
};

// Static method to find pending bills for a user
ConsolidatedBillSchema.statics.findPendingByUser = function(userId: string) {
  return this.find({ userId, status: ConsolidatedBillStatus.PENDING }).sort({ createdAt: -1 });
};

const ConsolidatedBill: Model<IConsolidatedBill> =
  mongoose.models.ConsolidatedBill ||
  mongoose.model<IConsolidatedBill>('ConsolidatedBill', ConsolidatedBillSchema);

export default ConsolidatedBill;
