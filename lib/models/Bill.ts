import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Bill Model
 * Stores user bills internally (replaces external BillAPI dependency)
 */

export interface IBill extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  linkedUserIds?: string[];
  billId: string; // Unique identifier for the bill
  provider: string;
  billType: string;
  amount?: number;
  dueDate: Date;
  accountNumber?: string;
  description?: string;
  monthlyRecords?: {
    id: string;
    month: string;
    amount: number;
    dueDate: Date;
    status: 'pending' | 'paid' | 'overdue';
    description?: string;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const BillSchema = new Schema<IBill>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    linkedUserIds: [{
      type: String,
      index: true,
    }],
    billId: {
      type: String,
      required: true,
      unique: true,
    },
    provider: {
      type: String,
      required: true,
    },
    billType: {
      type: String,
      required: true,
      enum: ['electricity', 'water', 'gas', 'mobile', 'internet', 'other'],
    },
    amount: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    accountNumber: {
      type: String,
    },
    description: {
      type: String,
    },
    monthlyRecords: [{
      id: String,
      month: String,
      amount: Number,
      dueDate: Date,
      status: {
        type: String,
        enum: ['pending', 'paid', 'overdue'],
        default: 'pending'
      },
      description: String,
      createdAt: { type: Date, default: Date.now }
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
BillSchema.index({ userId: 1, dueDate: 1 });
BillSchema.index({ userId: 1, billId: 1 }, { unique: true });

// Static method to find bills by user
BillSchema.statics.findByUser = function (userId: string) {
  return this.find({ $or: [{ userId }, { linkedUserIds: userId }] }).sort({ dueDate: 1 });
};

// Static method to find bills due within timeframe
BillSchema.statics.findDueWithin = function (userId: string, hours: number) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return this.find({
    $or: [{ userId }, { linkedUserIds: userId }],
    dueDate: {
      $gte: now,
      $lte: futureDate,
    },
  });
};

const Bill: Model<IBill> =
  mongoose.models.Bill || mongoose.model<IBill>('Bill', BillSchema);

export default Bill;
