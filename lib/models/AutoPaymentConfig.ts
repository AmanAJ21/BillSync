import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * AutoPaymentConfig Interface
 * Stores configuration for automatic bill payment
 * Validates: Requirements 1.2, 1.3
 */
export interface IAutoPaymentConfig extends Document {
  userId: string;
  billId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  disabledReason?: string;
}

const AutoPaymentConfigSchema = new Schema<IAutoPaymentConfig>(
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
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    disabledReason: {
      type: String,
      required: false,
      trim: true,
      maxlength: [500, 'Disabled reason cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries - ensures one config per user-bill combination
AutoPaymentConfigSchema.index({ userId: 1, billId: 1 }, { unique: true });

// Index for querying enabled auto-payments
AutoPaymentConfigSchema.index({ userId: 1, enabled: 1 });

// Instance method to disable auto-payment
AutoPaymentConfigSchema.methods.disable = function(reason?: string) {
  this.enabled = false;
  if (reason) {
    this.disabledReason = reason;
  }
  return this.save();
};

// Instance method to enable auto-payment
AutoPaymentConfigSchema.methods.enable = function() {
  this.enabled = true;
  this.disabledReason = undefined;
  return this.save();
};

const AutoPaymentConfig: Model<IAutoPaymentConfig> =
  mongoose.models.AutoPaymentConfig ||
  mongoose.model<IAutoPaymentConfig>('AutoPaymentConfig', AutoPaymentConfigSchema);

export default AutoPaymentConfig;
