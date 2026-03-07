import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PaymentMethodService } from '../PaymentMethodService';
import PaymentMethod from '../../models/PaymentMethod';
import AutoPaymentConfig from '../../models/AutoPaymentConfig';
import connectDB from '../../mongoose';

vi.mock('../../mongoose');
vi.mock('../../logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('PaymentMethodService - Error Scenarios', () => {
  let service: PaymentMethodService;

  beforeEach(() => {
    service = new PaymentMethodService();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await PaymentMethod.deleteMany({});
    await AutoPaymentConfig.deleteMany({});
  });

  describe('validatePaymentMethod', () => {
    it('should throw error when no payment method exists', async () => {
      // Mock no payment method found
      vi.spyOn(PaymentMethod, 'findOne').mockResolvedValue(null);

      await expect(
        service.validatePaymentMethod('user123')
      ).rejects.toThrow('No payment method found for user');
    });

    it('should throw error when payment method is expired', async () => {
      // Mock expired card payment method
      const expiredPaymentMethod = {
        _id: 'pm123',
        userId: 'user123',
        type: 'card',
        cardLast4: '4242',
        cardBrand: 'Visa',
        expiryMonth: 1,
        expiryYear: 2020,
        isDefault: true,
        isExpired: true, // Set to true after checkAndUpdateExpiry
        checkAndUpdateExpiry: vi.fn(async function(this: any) {
          this.isExpired = true;
          return true;
        }),
      };

      vi.spyOn(PaymentMethod, 'findOne').mockResolvedValue(expiredPaymentMethod as any);

      await expect(
        service.validatePaymentMethod('user123')
      ).rejects.toThrow('Payment method has expired');
    });

    it('should pass validation for valid payment method', async () => {
      // Mock valid card payment method
      const validPaymentMethod = {
        _id: 'pm123',
        userId: 'user123',
        type: 'card',
        cardLast4: '4242',
        cardBrand: 'Visa',
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
        isExpired: false,
        checkAndUpdateExpiry: vi.fn().mockResolvedValue(false),
      };

      vi.spyOn(PaymentMethod, 'findOne').mockResolvedValue(validPaymentMethod as any);

      const result = await service.validatePaymentMethod('user123');
      expect(result).toEqual(validPaymentMethod);
    });
  });

  describe('checkAndPauseExpiredPaymentMethods', () => {
    it('should pause auto-payments when payment method expires', async () => {
      // Mock expired card payment method
      const expiredPaymentMethod = {
        _id: 'pm123',
        userId: 'user123',
        type: 'card',
        cardLast4: '4242',
        cardBrand: 'Visa',
        expiryMonth: 1,
        expiryYear: 2020,
        isDefault: true,
        isExpired: false,
        checkAndUpdateExpiry: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(PaymentMethod, 'find').mockResolvedValue([expiredPaymentMethod] as any);
      vi.spyOn(PaymentMethod, 'findOne').mockResolvedValue(null); // No other valid payment method

      const updateManySpy = vi.spyOn(AutoPaymentConfig, 'updateMany').mockResolvedValue({
        acknowledged: true,
        modifiedCount: 2,
        upsertedId: null,
        upsertedCount: 0,
        matchedCount: 2,
      } as any);

      const affectedUserIds = await service.checkAndPauseExpiredPaymentMethods();

      expect(affectedUserIds).toEqual(['user123']);
      expect(updateManySpy).toHaveBeenCalledWith(
        { userId: 'user123', enabled: true },
        { $set: { enabled: false, disabledReason: 'Payment method expired' } }
      );
    });

    it('should not pause auto-payments when user has another valid payment method', async () => {
      // Mock expired card payment method
      const expiredPaymentMethod = {
        _id: 'pm123',
        userId: 'user123',
        type: 'card',
        cardLast4: '4242',
        cardBrand: 'Visa',
        expiryMonth: 1,
        expiryYear: 2020,
        isDefault: true,
        isExpired: false,
        checkAndUpdateExpiry: vi.fn().mockResolvedValue(true),
      };

      // Mock another valid payment method
      const validPaymentMethod = {
        _id: 'pm456',
        userId: 'user123',
        type: 'upi',
        upiId: 'user@upi',
        isDefault: false,
        isExpired: false,
      };

      vi.spyOn(PaymentMethod, 'find').mockResolvedValue([expiredPaymentMethod] as any);
      vi.spyOn(PaymentMethod, 'findOne').mockResolvedValue(validPaymentMethod as any);

      const updateManySpy = vi.spyOn(AutoPaymentConfig, 'updateMany');

      const affectedUserIds = await service.checkAndPauseExpiredPaymentMethods();

      expect(affectedUserIds).toEqual([]);
      expect(updateManySpy).not.toHaveBeenCalled();
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should throw error when payment method not found', async () => {
      vi.spyOn(PaymentMethod, 'findOne').mockResolvedValue(null);

      await expect(
        service.setDefaultPaymentMethod('user123', 'pm123')
      ).rejects.toThrow('Payment method not found');
    });

    it('should throw error when trying to set expired payment method as default', async () => {
      const expiredPaymentMethod = {
        _id: 'pm123',
        userId: 'user123',
        type: 'card',
        cardLast4: '4242',
        cardBrand: 'Visa',
        expiryMonth: 1,
        expiryYear: 2020,
        isDefault: false,
        isExpired: true, // Set to true after checkAndUpdateExpiry
        checkAndUpdateExpiry: vi.fn(async function(this: any) {
          this.isExpired = true;
          return true;
        }),
        save: vi.fn(),
      };

      vi.spyOn(PaymentMethod, 'findOne').mockResolvedValue(expiredPaymentMethod as any);

      await expect(
        service.setDefaultPaymentMethod('user123', 'pm123')
      ).rejects.toThrow('Cannot set expired payment method as default');
    });
  });
});
