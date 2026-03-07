import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoPaymentService } from '../AutoPaymentService';

vi.mock('../../mongoose');
vi.mock('../../logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AutoPaymentService - Error Scenarios', () => {
  let service: AutoPaymentService;

  beforeEach(() => {
    service = new AutoPaymentService();
    vi.clearAllMocks();
  });

  describe('Payment method expiry handling', () => {
    it('should throw error when enabling auto-payment with expired payment method', async () => {
      // Mock PaymentMethodService to throw expired error
      vi.doMock('../PaymentMethodService', () => ({
        paymentMethodService: {
          validatePaymentMethod: vi.fn().mockRejectedValue(
            new Error('Payment method has expired')
          ),
          pauseAllAutoPayments: vi.fn(),
        },
      }));

      await expect(
        service.enableAutomaticPayment('user123', 'bill123')
      ).rejects.toThrow('Payment method has expired');
    });

    it('should throw error when enabling auto-payment with no payment method', async () => {
      // Mock PaymentMethodService to throw no payment method error
      vi.doMock('../PaymentMethodService', () => ({
        paymentMethodService: {
          validatePaymentMethod: vi.fn().mockRejectedValue(
            new Error('No payment method found for user')
          ),
        },
      }));

      await expect(
        service.enableAutomaticPayment('user123', 'bill123')
      ).rejects.toThrow('No payment method found for user');
    });
  });

  describe('BillAPI unavailability', () => {
    it('should handle BillAPI unavailability during bill query', async () => {
      // Mock PaymentMethodService
      vi.doMock('../PaymentMethodService', () => ({
        paymentMethodService: {
          validatePaymentMethod: vi.fn().mockResolvedValue({}),
        },
      }));

      // Mock BillAPIClient to throw unavailable error
      vi.doMock('../BillAPIClient', () => ({
        getBillAPIClient: vi.fn(() => ({
          queryBill: vi.fn().mockRejectedValue(new Error('BillAPI unavailable')),
        })),
      }));

      await expect(
        service.enableAutomaticPayment('user123', 'bill123')
      ).rejects.toThrow('BillAPI unavailable');
    });
  });
});
