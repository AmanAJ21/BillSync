import mongoose, { Schema, Document } from 'mongoose';

/**
 * PaymentMethod Model
 * Stores user payment method details for automatic payments
 * Validates: Requirements 1.5, 9.2
 */

export interface IPaymentMethod extends Document {
  userId: string;
  type: 'card' | 'bank_account' | 'upi';
  cardLast4?: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  bankName?: string;
  accountLast4?: string;
  upiId?: string;
  isDefault: boolean;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['card', 'bank_account', 'upi'],
      required: true,
    },
    // Card details
    cardLast4: {
      type: String,
      required: function(this: IPaymentMethod) {
        return this.type === 'card';
      },
    },
    cardBrand: {
      type: String,
      required: function(this: IPaymentMethod) {
        return this.type === 'card';
      },
    },
    expiryMonth: {
      type: Number,
      min: 1,
      max: 12,
      required: function(this: IPaymentMethod) {
        return this.type === 'card';
      },
    },
    expiryYear: {
      type: Number,
      required: function(this: IPaymentMethod) {
        return this.type === 'card';
      },
    },
    // Bank account details
    bankName: {
      type: String,
      required: function(this: IPaymentMethod) {
        return this.type === 'bank_account';
      },
    },
    accountLast4: {
      type: String,
      required: function(this: IPaymentMethod) {
        return this.type === 'bank_account';
      },
    },
    // UPI details
    upiId: {
      type: String,
      required: function(this: IPaymentMethod) {
        return this.type === 'upi';
      },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isExpired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding user's default payment method
PaymentMethodSchema.index({ userId: 1, isDefault: 1 });

// Virtual to check if card is expired
PaymentMethodSchema.virtual('isCardExpired').get(function(this: IPaymentMethod) {
  if (this.type !== 'card' || !this.expiryMonth || !this.expiryYear) {
    return false;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11

  if (this.expiryYear < currentYear) {
    return true;
  }

  if (this.expiryYear === currentYear && this.expiryMonth < currentMonth) {
    return true;
  }

  return false;
});

// Method to check and update expiry status
PaymentMethodSchema.methods.checkAndUpdateExpiry = async function(this: IPaymentMethod) {
  if (this.type === 'card' && this.expiryMonth && this.expiryYear) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11

    let isExpired = false;
    
    if (this.expiryYear < currentYear) {
      isExpired = true;
    } else if (this.expiryYear === currentYear && this.expiryMonth < currentMonth) {
      isExpired = true;
    }
    
    if (isExpired !== this.isExpired) {
      this.isExpired = isExpired;
      await this.save();
    }
  }
  return this.isExpired;
};

const PaymentMethod = mongoose.models.PaymentMethod || mongoose.model<IPaymentMethod>('PaymentMethod', PaymentMethodSchema);

export default PaymentMethod;
