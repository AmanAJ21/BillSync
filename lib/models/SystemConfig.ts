import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * SystemConfig Model
 * Stores system-wide configuration settings that only admins can modify
 */

export interface ISystemConfig extends Document {
  _id: mongoose.Types.ObjectId;
  key: string; // Unique config key
  value: any; // Config value (flexible type)
  category: 'payment' | 'notification' | 'auto_payment' | 'general';
  description: string;
  lastModifiedBy: string; // Admin user ID
  lastModifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
  {
    key: {
      type: String,
      required: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['payment', 'notification', 'auto_payment', 'general'],
    },
    description: {
      type: String,
      required: true,
    },
    lastModifiedBy: {
      type: String,
      required: true,
    },
    lastModifiedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SystemConfigSchema.index({ key: 1 }, { unique: true });
SystemConfigSchema.index({ category: 1 });

const SystemConfig: Model<ISystemConfig> =
  mongoose.models.SystemConfig || mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);

export default SystemConfig;
