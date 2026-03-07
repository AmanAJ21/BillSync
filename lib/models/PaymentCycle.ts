import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * PaymentCycle Interface
 * Defines the aggregation period for bills
 * Validates: Requirements 7.1, 7.3, 7.4
 */
export interface IPaymentCycle extends Document {
  userId: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  // Virtual property
  isActive: boolean;
}

// Status enum for validation
export const PaymentCycleStatus = {
  ACTIVE: 'active' as const,
  COMPLETED: 'completed' as const,
};

const PaymentCycleSchema = new Schema<IPaymentCycle>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      trim: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      validate: {
        validator: function(value: Date) {
          return value > (this as any).startDate;
        },
        message: 'End date must be after start date',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'completed'],
        message: '{VALUE} is not a valid status',
      },
      required: true,
      default: 'active',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient queries
PaymentCycleSchema.index({ userId: 1, status: 1 });
PaymentCycleSchema.index({ userId: 1, startDate: 1, endDate: 1 });

// Virtual property to check if cycle is active
PaymentCycleSchema.virtual('isActive').get(function() {
  return this.status === PaymentCycleStatus.ACTIVE;
});

// Instance method to complete the cycle
PaymentCycleSchema.methods.complete = function() {
  this.status = PaymentCycleStatus.COMPLETED;
  return this.save();
};

// Static method to find active cycle for a user
PaymentCycleSchema.statics.findActiveByUser = function(userId: string) {
  return this.findOne({ userId, status: PaymentCycleStatus.ACTIVE });
};

// Static method to ensure only one active cycle per user
PaymentCycleSchema.pre('save', async function() {
  if (this.isNew && this.status === PaymentCycleStatus.ACTIVE) {
    const existingActive = await (this.constructor as Model<IPaymentCycle>).findOne({
      userId: this.userId,
      status: PaymentCycleStatus.ACTIVE,
      _id: { $ne: this._id },
    });
    
    if (existingActive) {
      throw new Error('User already has an active payment cycle');
    }
  }
});

const PaymentCycle: Model<IPaymentCycle> =
  mongoose.models.PaymentCycle ||
  mongoose.model<IPaymentCycle>('PaymentCycle', PaymentCycleSchema);

export default PaymentCycle;
