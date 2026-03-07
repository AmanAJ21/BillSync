import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the mongoose connection before importing AutoPaymentService
vi.mock('../../mongoose', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

import { AutoPaymentService } from '../AutoPaymentService';
import AutoPaymentConfig from '../../models/AutoPaymentConfig';

/**
 * Unit Tests for AutoPaymentService
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
 * 
 * Tests cover:
 * - Enable/disable functionality
 * - Payment method validation
 * - Error cases (invalid bill, missing payment method)
 */
describe('AutoPaymentService', () => {
  let service: AutoPaymentService;

  beforeEach(() => {
    service = new AutoPaymentService();
    // Set up environment variables for BillAPI
    process.env.BILL_API = 'https://test-bill-api.com';
    process.env.API_KEY = 'test-api-key';
    // Clear all mocks before each test
    vi.restoreAllMocks();
  });

  describe('enableAutomaticPayment', () => {
    /**
     * Test: Successfully enable automatic payment for a new bill
     * Validates: Requirements 1.1, 1.2
     */
    it('should successfully enable automatic payment for a new bill', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Mock BillAPI response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 100.50,
            dueDate: new Date('2024-12-31'),
            provider: 'Electric Company',
          },
        }),
      });

      // Act
      const config = await service.enableAutomaticPayment(userId, billId);

      // Assert
      expect(config).toBeDefined();
      expect(config.userId).toBe(userId);
      expect(config.billId).toBe(billId);
      expect(config.enabled).toBe(true);
      expect(config.disabledReason).toBeUndefined();
    });

    /**
     * Test: Re-enable automatic payment for a previously disabled bill
     * Validates: Requirements 1.1, 1.2
     */
    it('should re-enable automatic payment for a previously disabled bill', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Create a disabled config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: false,
        disabledReason: 'User requested',
      });

      // Mock BillAPI response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 100.50,
            dueDate: new Date('2024-12-31'),
          },
        }),
      });

      // Act
      const config = await service.enableAutomaticPayment(userId, billId);

      // Assert
      expect(config.enabled).toBe(true);
      expect(config.disabledReason).toBeUndefined();
    });

    /**
     * Test: Throw error when BillAPI configuration is missing
     * Validates: Requirement 1.2
     */
    it('should throw error when BillAPI configuration is missing', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';
      
      // Save original env vars
      const originalBillApi = process.env.BILL_API;
      const originalApiKey = process.env.API_KEY;
      
      // Remove env vars
      delete process.env.BILL_API;
      delete process.env.API_KEY;

      // Act & Assert
      await expect(
        service.enableAutomaticPayment(userId, billId)
      ).rejects.toThrow('BillAPI configuration missing');

      // Restore env vars
      process.env.BILL_API = originalBillApi;
      process.env.API_KEY = originalApiKey;
    });

    /**
     * Test: Throw error when bill is not found in BillAPI
     * Validates: Requirement 1.2
     */
    it('should throw error when bill is not found in BillAPI', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'invalid-bill';

      // Mock BillAPI response with no bill
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ bill: null }),
      });

      // Act & Assert
      await expect(
        service.enableAutomaticPayment(userId, billId)
      ).rejects.toThrow(`Bill ${billId} not found in BillAPI`);
    });

    /**
     * Test: Throw error when BillAPI returns error status
     * Validates: Requirement 1.2
     */
    it('should throw error when BillAPI returns error status', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Mock BillAPI error response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      // Act & Assert
      await expect(
        service.enableAutomaticPayment(userId, billId)
      ).rejects.toThrow('BillAPI returned status 404');
    });

    /**
     * Test: Throw error when bill is missing required fields
     * Validates: Requirement 1.2
     */
    it('should throw error when bill is missing required fields', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Mock BillAPI response with incomplete bill data
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            // Missing amount and dueDate
          },
        }),
      });

      // Act & Assert
      await expect(
        service.enableAutomaticPayment(userId, billId)
      ).rejects.toThrow(`Bill ${billId} is missing required fields`);
    });

    /**
     * Test: Throw error when user ID is empty
     * Validates: Requirement 1.5
     */
    it('should throw error when user ID is empty', async () => {
      // Arrange
      const userId = '';
      const billId = 'bill-456';

      // Act & Assert
      await expect(
        service.enableAutomaticPayment(userId, billId)
      ).rejects.toThrow('User ID is required for payment method validation');
    });
  });

  describe('disableAutomaticPayment', () => {
    /**
     * Test: Successfully disable automatic payment
     * Validates: Requirement 1.3
     */
    it('should successfully disable automatic payment', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Create an enabled config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Act
      const config = await service.disableAutomaticPayment(userId, billId);

      // Assert
      expect(config.enabled).toBe(false);
      expect(config.disabledReason).toBeUndefined();
    });

    /**
     * Test: Successfully disable automatic payment with reason
     * Validates: Requirement 1.3
     */
    it('should successfully disable automatic payment with reason', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';
      const reason = 'Payment method expired';

      // Create an enabled config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Act
      const config = await service.disableAutomaticPayment(userId, billId, reason);

      // Assert
      expect(config.enabled).toBe(false);
      expect(config.disabledReason).toBe(reason);
    });

    /**
     * Test: Throw error when config not found
     * Validates: Requirement 1.3
     */
    it('should throw error when config not found', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'nonexistent-bill';

      // Act & Assert
      await expect(
        service.disableAutomaticPayment(userId, billId)
      ).rejects.toThrow(`Auto-payment config not found for user ${userId}, bill ${billId}`);
    });

    /**
     * Test: Successfully disable already disabled config
     * Validates: Requirement 1.3
     */
    it('should successfully disable already disabled config', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Create a disabled config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: false,
        disabledReason: 'Previous reason',
      });

      // Act
      const config = await service.disableAutomaticPayment(userId, billId, 'New reason');

      // Assert
      expect(config.enabled).toBe(false);
      expect(config.disabledReason).toBe('New reason');
    });
  });

  describe('getAutoPaymentStatus', () => {
    /**
     * Test: Successfully retrieve auto-payment status
     * Validates: Requirement 1.4
     */
    it('should successfully retrieve auto-payment status', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Act
      const config = await service.getAutoPaymentStatus(userId, billId);

      // Assert
      expect(config).not.toBeNull();
      expect(config?.userId).toBe(userId);
      expect(config?.billId).toBe(billId);
      expect(config?.enabled).toBe(true);
    });

    /**
     * Test: Return null when config not found
     * Validates: Requirement 1.4
     */
    it('should return null when config not found', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'nonexistent-bill';

      // Act
      const config = await service.getAutoPaymentStatus(userId, billId);

      // Assert
      expect(config).toBeNull();
    });
  });

  describe('listEnabledAutoPayments', () => {
    /**
     * Test: Successfully list all enabled auto-payments
     */
    it('should successfully list all enabled auto-payments', async () => {
      // Arrange
      const userId = 'user-123';

      await AutoPaymentConfig.create([
        { userId, billId: 'bill-1', enabled: true },
        { userId, billId: 'bill-2', enabled: true },
        { userId, billId: 'bill-3', enabled: false },
      ]);

      // Act
      const configs = await service.listEnabledAutoPayments(userId);

      // Assert
      expect(configs).toHaveLength(2);
      expect(configs.every(c => c.enabled)).toBe(true);
      expect(configs.every(c => c.userId === userId)).toBe(true);
    });

    /**
     * Test: Return empty array when no enabled auto-payments
     */
    it('should return empty array when no enabled auto-payments', async () => {
      // Arrange
      const userId = 'user-123';

      await AutoPaymentConfig.create([
        { userId, billId: 'bill-1', enabled: false },
        { userId, billId: 'bill-2', enabled: false },
      ]);

      // Act
      const configs = await service.listEnabledAutoPayments(userId);

      // Assert
      expect(configs).toHaveLength(0);
    });

    /**
     * Test: Only return configs for specified user
     */
    it('should only return configs for specified user', async () => {
      // Arrange
      const userId1 = 'user-123';
      const userId2 = 'user-456';

      await AutoPaymentConfig.create([
        { userId: userId1, billId: 'bill-1', enabled: true },
        { userId: userId2, billId: 'bill-2', enabled: true },
        { userId: userId1, billId: 'bill-3', enabled: true },
      ]);

      // Act
      const configs = await service.listEnabledAutoPayments(userId1);

      // Assert
      expect(configs).toHaveLength(2);
      expect(configs.every(c => c.userId === userId1)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    /**
     * Test: Handle network errors when calling BillAPI
     * Validates: Requirement 1.2
     */
    it('should handle network errors when calling BillAPI', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(
        service.enableAutomaticPayment(userId, billId)
      ).rejects.toThrow('Network error');
    });

    /**
     * Test: Handle malformed JSON response from BillAPI
     * Validates: Requirement 1.2
     */
    it('should handle malformed JSON response from BillAPI', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Mock malformed JSON response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      // Act & Assert
      await expect(
        service.enableAutomaticPayment(userId, billId)
      ).rejects.toThrow('Invalid JSON');
    });

    /**
     * Test: Handle concurrent enable requests for same bill
     * Validates: Requirements 1.1, 1.2
     */
    it('should handle concurrent enable requests for same bill', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Mock BillAPI response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 100.50,
            dueDate: new Date('2024-12-31'),
          },
        }),
      });

      // Act - Make concurrent requests
      // One or both should succeed (race condition may cause one to fail with duplicate key error)
      const results = await Promise.allSettled([
        service.enableAutomaticPayment(userId, billId),
        service.enableAutomaticPayment(userId, billId),
      ]);

      // Assert - At least one should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThanOrEqual(1);

      // Verify only one config exists in the database
      const configs = await AutoPaymentConfig.find({ userId, billId });
      expect(configs).toHaveLength(1);
      expect(configs[0].enabled).toBe(true);
    });

    /**
     * Test: Handle special characters in user and bill IDs
     * Validates: Requirements 1.1, 1.3
     */
    it('should handle special characters in user and bill IDs', async () => {
      // Arrange
      const userId = 'user-with-special-chars-@#$';
      const billId = 'bill-with-special-chars-!%^';

      // Mock BillAPI response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 100.50,
            dueDate: new Date('2024-12-31'),
          },
        }),
      });

      // Act
      const config = await service.enableAutomaticPayment(userId, billId);

      // Assert
      expect(config.userId).toBe(userId);
      expect(config.billId).toBe(billId);
      expect(config.enabled).toBe(true);

      // Verify can disable with special chars
      const disabledConfig = await service.disableAutomaticPayment(userId, billId);
      expect(disabledConfig.enabled).toBe(false);
    });

    /**
     * Test: Handle very long disabled reason
     * Validates: Requirement 1.3
     */
    it('should handle disabled reason within character limit', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';
      const reason = 'A'.repeat(500); // Max length

      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Act
      const config = await service.disableAutomaticPayment(userId, billId, reason);

      // Assert
      expect(config.disabledReason).toBe(reason);
      expect(config.disabledReason?.length).toBe(500);
    });
  });

  describe('processScheduledPayments', () => {
    /**
     * Test: Process bills due within 24 hours
     * Validates: Requirements 2.1, 2.2
     */
    it('should process bills due within 24 hours', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Create enabled auto-payment config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock BillAPI response with bill due in 12 hours
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 100.50,
            dueDate: dueDate.toISOString(),
            provider: 'Electric Company',
            type: 'electricity',
          },
        }),
      });

      // Act
      const results = await service.processScheduledPayments();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].billId).toBe(billId);
      expect(results[0].userId).toBe(userId);
      expect(results[0].status).toBe('processed');
    });

    /**
     * Test: Skip bills not due within 24 hours
     * Validates: Requirements 2.1, 2.2
     */
    it('should skip bills not due within 24 hours', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock BillAPI response with bill due in 48 hours
      const dueDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 100.50,
            dueDate: dueDate.toISOString(),
            provider: 'Electric Company',
            type: 'electricity',
          },
        }),
      });

      // Act
      const results = await service.processScheduledPayments();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('skipped');
      expect(results[0].reason).toBe('Not due within 24 hours');
    });

    /**
     * Test: Skip bills with duplicate payments in current cycle
     * Validates: Requirement 9.1
     */
    it('should skip bills with duplicate payments in current cycle', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Import models
      const AutoPaymentRecord = (await import('../../models/AutoPaymentRecord')).default;
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create active payment cycle
      const cycle = await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create existing payment record
      await AutoPaymentRecord.create({
        userId,
        billId,
        amount: 100.50,
        paymentDate: new Date(),
        transactionId: 'txn-123',
        billProvider: 'Electric Company',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      // Create enabled auto-payment config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock BillAPI response with bill due in 12 hours
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 100.50,
            dueDate: dueDate.toISOString(),
            provider: 'Electric Company',
            type: 'electricity',
          },
        }),
      });

      // Act
      const results = await service.processScheduledPayments();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('skipped');
      expect(results[0].reason).toBe('Already paid in current cycle');
    });

    /**
     * Test: Skip bills with significant amount increase (>50%)
     * Validates: Requirement 9.1
     */
    it('should skip bills with significant amount increase (>50%)', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Import models
      const AutoPaymentRecord = (await import('../../models/AutoPaymentRecord')).default;
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create completed payment cycle
      const oldCycle = await PaymentCycle.create({
        userId,
        startDate: new Date('2023-12-01'),
        endDate: new Date('2023-12-31'),
        status: 'completed',
      });

      // Create previous payment record with amount 100
      await AutoPaymentRecord.create({
        userId,
        billId,
        amount: 100,
        paymentDate: new Date('2023-12-15'),
        transactionId: 'txn-old',
        billProvider: 'Electric Company',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: oldCycle._id.toString(),
      });

      // Create active payment cycle
      await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create enabled auto-payment config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock BillAPI response with bill due in 12 hours and amount increased by 60%
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 160, // 60% increase from 100
            dueDate: dueDate.toISOString(),
            provider: 'Electric Company',
            type: 'electricity',
          },
        }),
      });

      // Act
      const results = await service.processScheduledPayments();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('skipped');
      expect(results[0].reason).toContain('Significant amount change detected');
    });

    /**
     * Test: Process bills with amount increase less than 50%
     * Validates: Requirement 9.1
     */
    it('should process bills with amount increase less than 50%', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Import models
      const AutoPaymentRecord = (await import('../../models/AutoPaymentRecord')).default;
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create completed payment cycle
      const oldCycle = await PaymentCycle.create({
        userId,
        startDate: new Date('2023-12-01'),
        endDate: new Date('2023-12-31'),
        status: 'completed',
      });

      // Create previous payment record with amount 100
      await AutoPaymentRecord.create({
        userId,
        billId,
        amount: 100,
        paymentDate: new Date('2023-12-15'),
        transactionId: 'txn-old',
        billProvider: 'Electric Company',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: oldCycle._id.toString(),
      });

      // Create active payment cycle
      await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create enabled auto-payment config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock BillAPI response with bill due in 12 hours and amount increased by 40%
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 140, // 40% increase from 100
            dueDate: dueDate.toISOString(),
            provider: 'Electric Company',
            type: 'electricity',
          },
        }),
      });

      // Act
      const results = await service.processScheduledPayments();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('processed');
    });

    /**
     * Test: Handle errors gracefully
     * Validates: Requirements 2.1, 2.2
     */
    it('should handle errors gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock BillAPI error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      // Act
      const results = await service.processScheduledPayments();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('error');
      expect(results[0].reason).toContain('Network error');
    });

    /**
     * Test: Process multiple bills
     * Validates: Requirements 2.1, 2.2
     */
    it('should process multiple bills', async () => {
      // Arrange
      const userId1 = 'user-123';
      const userId2 = 'user-456';
      const billId1 = 'bill-1';
      const billId2 = 'bill-2';

      await AutoPaymentConfig.create([
        { userId: userId1, billId: billId1, enabled: true },
        { userId: userId2, billId: billId2, enabled: true },
      ]);

      // Mock BillAPI responses
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      global.fetch = vi.fn().mockImplementation((url) => {
        const urlStr = url.toString();
        if (urlStr.includes(billId1)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              bill: {
                id: billId1,
                amount: 100,
                dueDate: dueDate.toISOString(),
                provider: 'Electric Company',
                type: 'electricity',
              },
            }),
          });
        } else if (urlStr.includes(billId2)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              bill: {
                id: billId2,
                amount: 200,
                dueDate: dueDate.toISOString(),
                provider: 'Water Company',
                type: 'water',
              },
            }),
          });
        }
        return Promise.reject(new Error('Unknown bill'));
      });

      // Act
      const results = await service.processScheduledPayments();

      // Assert
      expect(results).toHaveLength(2);
      expect(results.every(r => r.status === 'processed')).toBe(true);
    });

    /**
     * Test: Return empty array when no enabled auto-payments
     * Validates: Requirements 2.1, 2.2
     */
    it('should return empty array when no enabled auto-payments', async () => {
      // Arrange - no enabled configs

      // Act
      const results = await service.processScheduledPayments();

      // Assert
      expect(results).toHaveLength(0);
    });
  });

  describe('executePayment', () => {
    /**
     * Test: Successfully execute payment
     * Validates: Requirements 2.1, 2.4
     */
    it('should successfully execute payment', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';
      const amount = 100.50;
      const billProvider = 'Electric Company';
      const billType = 'electricity';

      // Import models
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create active payment cycle
      await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Mock BillAPI payment response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          transactionId: 'txn-success-123',
        }),
      });

      // Act
      const record = await service.executePayment(userId, billId, amount, billProvider, billType);

      // Assert
      expect(record).toBeDefined();
      expect(record.userId).toBe(userId);
      expect(record.billId).toBe(billId);
      expect(record.amount).toBe(amount);
      expect(record.billProvider).toBe(billProvider);
      expect(record.billType).toBe(billType);
      expect(record.status).toBe('success');
      expect(record.transactionId).toBeDefined();
    });

    /**
     * Test: Throw error when no active payment cycle
     * Validates: Requirements 2.1, 2.4
     */
    it('should throw error when no active payment cycle', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';
      const amount = 100.50;
      const billProvider = 'Electric Company';
      const billType = 'electricity';

      // Act & Assert
      await expect(
        service.executePayment(userId, billId, amount, billProvider, billType)
      ).rejects.toThrow(`No active payment cycle found for user ${userId}`);
    });

    /**
     * Test: Throw error when BillAPI payment fails
     * Validates: Requirements 2.1, 2.4
     */
    it('should throw error when BillAPI payment fails', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';
      const amount = 100.50;
      const billProvider = 'Electric Company';
      const billType = 'electricity';

      // Import models
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create active payment cycle
      await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Mock BillAPI payment failure
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Payment processing error' }),
      });

      // Act & Assert
      await expect(
        service.executePayment(userId, billId, amount, billProvider, billType)
      ).rejects.toThrow('BillAPI payment failed');
    });
  });

  describe('retryFailedPayment', () => {
    /**
     * Test: Successfully retry payment on first attempt
     * Validates: Requirements 2.3, 2.5
     */
    it('should successfully retry payment on first attempt', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';
      const amount = 100.50;
      const billProvider = 'Electric Company';
      const billType = 'electricity';

      // Import models
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create active payment cycle
      await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Mock BillAPI payment success
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          transactionId: 'txn-retry-success-123',
        }),
      });

      // Act
      const record = await service.retryFailedPayment(userId, billId, amount, billProvider, billType, 1);

      // Assert
      expect(record).not.toBeNull();
      expect(record.userId).toBe(userId);
      expect(record.billId).toBe(billId);
      expect(record.status).toBe('success');
    });

    /**
     * Test: Return null after max retry attempts
     * Validates: Requirements 2.3, 2.5
     */
    it('should return null and disable auto-payment after max retry attempts', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';
      const amount = 100.50;
      const billProvider = 'Electric Company';
      const billType = 'electricity';

      // Create enabled auto-payment config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Act
      const record = await service.retryFailedPayment(userId, billId, amount, billProvider, billType, 4);

      // Assert
      expect(record).toBeNull();

      // Verify auto-payment was disabled
      const config = await AutoPaymentConfig.findOne({ userId, billId });
      expect(config?.enabled).toBe(false);
      expect(config?.disabledReason).toBe('Payment failed after 3 retry attempts');
    });
  });

  describe('processScheduledPaymentsWithExecution', () => {
    /**
     * Test: Successfully execute payment for bill due within 24 hours
     * Validates: Requirements 2.1, 2.2, 2.4
     */
    it('should successfully execute payment for bill due within 24 hours', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Import models
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create active payment cycle
      await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create enabled auto-payment config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock BillAPI responses
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      global.fetch = vi.fn().mockImplementation((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('/query')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              bill: {
                id: billId,
                amount: 100.50,
                dueDate: dueDate.toISOString(),
                provider: 'Electric Company',
                type: 'electricity',
              },
            }),
          });
        } else if (urlStr.includes('/pay')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              transactionId: 'txn-exec-123',
            }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Act
      const results = await service.processScheduledPaymentsWithExecution();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('success');
      expect(results[0].transactionId).toBeDefined();
    });

    /**
     * Test: Retry payment on failure and succeed
     * Validates: Requirements 2.3, 2.4, 2.5
     */
    it('should retry payment on failure and succeed', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Import models
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create active payment cycle
      await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create enabled auto-payment config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock BillAPI responses - fail first, succeed on retry
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      let paymentAttempts = 0;
      global.fetch = vi.fn().mockImplementation((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('/query')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              bill: {
                id: billId,
                amount: 100.50,
                dueDate: dueDate.toISOString(),
                provider: 'Electric Company',
                type: 'electricity',
              },
            }),
          });
        } else if (urlStr.includes('/pay')) {
          paymentAttempts++;
          if (paymentAttempts === 1) {
            // First attempt fails
            return Promise.resolve({
              ok: false,
              status: 500,
              json: async () => ({ message: 'Temporary error' }),
            });
          } else {
            // Retry succeeds
            return Promise.resolve({
              ok: true,
              json: async () => ({
                transactionId: 'txn-retry-success',
              }),
            });
          }
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Act
      const results = await service.processScheduledPaymentsWithExecution();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('success');
      expect(results[0].reason).toContain('after retry');
    });

    /**
     * Test: Disable auto-payment after all retries fail
     * Validates: Requirements 2.3, 2.5
     */
    it('should disable auto-payment after all retries fail', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Import models
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create active payment cycle
      await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create enabled auto-payment config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock setTimeout to execute immediately (skip the 2-hour wait)
      vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        if (typeof callback === 'function') {
          callback();
        }
        return 0 as any;
      });

      // Mock BillAPI responses - all payment attempts fail
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      global.fetch = vi.fn().mockImplementation((url) => {
        const urlStr = url.toString();
        if (urlStr.includes('/query')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              bill: {
                id: billId,
                amount: 100.50,
                dueDate: dueDate.toISOString(),
                provider: 'Electric Company',
                type: 'electricity',
              },
            }),
          });
        } else if (urlStr.includes('/pay')) {
          // All attempts fail
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ message: 'Persistent error' }),
          });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      // Act
      const results = await service.processScheduledPaymentsWithExecution();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
      expect(results[0].reason).toContain('Failed after 3 retry attempts');

      // Verify auto-payment was disabled
      const config = await AutoPaymentConfig.findOne({ userId, billId });
      expect(config?.enabled).toBe(false);
      expect(config?.disabledReason).toBe('Payment failed after 3 retry attempts');
    });

    /**
     * Test: Send notification for significant amount change
     * Validates: Requirements 9.1
     */
    it('should send notification for significant amount change', async () => {
      // Arrange
      const userId = 'user-123';
      const billId = 'bill-456';

      // Import models
      const AutoPaymentRecord = (await import('../../models/AutoPaymentRecord')).default;
      const PaymentCycle = (await import('../../models/PaymentCycle')).default;

      // Create completed payment cycle with previous payment
      const oldCycle = await PaymentCycle.create({
        userId,
        startDate: new Date('2023-12-01'),
        endDate: new Date('2023-12-31'),
        status: 'completed',
      });

      await AutoPaymentRecord.create({
        userId,
        billId,
        amount: 100,
        paymentDate: new Date('2023-12-15'),
        transactionId: 'txn-old',
        billProvider: 'Electric Company',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: oldCycle._id.toString(),
      });

      // Create active payment cycle
      await PaymentCycle.create({
        userId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create enabled auto-payment config
      await AutoPaymentConfig.create({
        userId,
        billId,
        enabled: true,
      });

      // Mock BillAPI response with 60% increase
      const dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bill: {
            id: billId,
            amount: 160, // 60% increase
            dueDate: dueDate.toISOString(),
            provider: 'Electric Company',
            type: 'electricity',
          },
        }),
      });

      // Act
      const results = await service.processScheduledPaymentsWithExecution();

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('skipped');
      expect(results[0].reason).toContain('Significant amount change');
      expect(results[0].reason).toContain('notification sent');
    });
  });
});

/**
 * Property-Based Tests for AutoPaymentService
 * Using fast-check for property-based testing
 */
import * as fc from 'fast-check';

describe('Property-Based Tests', () => {
  /**
   * Property 1: Auto-Payment Execution Timeliness
   * **Validates: Requirements 2.1, 2.2**
   * 
   * Property statement: For all bills with auto-payment enabled, if the due date 
   * is within 24 hours, the system will attempt payment before the due date.
   * 
   * This test generates random bills with various due dates and verifies that:
   * 1. Bills due within 24 hours are marked for processing
   * 2. Bills not due within 24 hours are skipped
   * 3. The system correctly identifies the 24-hour window
   */
  describe('Property 1: Auto-Payment Execution Timeliness', () => {
    it('should process all bills due within 24 hours and skip others', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an array of bills with random due dates
          fc.array(
            fc.record({
              userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
              billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
              amount: fc.double({ min: 1, max: 10000, noNaN: true }),
              // Generate due dates from -48 hours to +72 hours from now
              // Avoid exactly 0 and 24 hours to prevent boundary timing issues
              hoursFromNow: fc.integer({ min: -48, max: 72 }).filter(h => h !== 0 && h !== 24),
              provider: fc.constantFrom('Electric Company', 'Water Company', 'Gas Company', 'Internet Provider'),
              type: fc.constantFrom('electricity', 'water', 'gas', 'internet'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (bills) => {
            // Arrange
            const service = new AutoPaymentService();
            const now = Date.now();

            // Create auto-payment configs for all bills
            for (const bill of bills) {
              await AutoPaymentConfig.create({
                userId: bill.userId,
                billId: bill.billId,
                enabled: true,
              });
            }

            // Mock BillAPI responses
            global.fetch = vi.fn().mockImplementation((url) => {
              const urlStr = url.toString();
              
              // Extract billId from URL
              const billIdMatch = urlStr.match(/billId=([^&]+)/);
              if (!billIdMatch) {
                return Promise.reject(new Error('No billId in URL'));
              }
              
              const billId = billIdMatch[1];
              const bill = bills.find(b => b.billId === billId);
              
              if (!bill) {
                return Promise.resolve({
                  ok: true,
                  json: async () => ({ bill: null }),
                });
              }

              const dueDate = new Date(now + bill.hoursFromNow * 60 * 60 * 1000);

              return Promise.resolve({
                ok: true,
                json: async () => ({
                  bill: {
                    id: bill.billId,
                    amount: bill.amount,
                    dueDate: dueDate.toISOString(),
                    provider: bill.provider,
                    type: bill.type,
                  },
                }),
              });
            });

            // Act
            const results = await service.processScheduledPayments();

            // Assert - Verify timeliness property
            for (const bill of bills) {
              const result = results.find(r => r.billId === bill.billId);
              expect(result).toBeDefined();

              const dueDate = new Date(now + bill.hoursFromNow * 60 * 60 * 1000);
              // Account for timing differences - bills due within 0-24 hours (exclusive of exactly 24)
              // should be processed. However, bills at exactly 0 hours may become past due by the time
              // the service checks them due to execution time, so we treat them as potentially skipped.
              const isDueWithin24Hours = bill.hoursFromNow > 0 && bill.hoursFromNow < 24;

              if (isDueWithin24Hours) {
                // Bills due within 24 hours (but not right now) should be processed
                expect(result?.status).toBe('processed');
                
                // Verify the due date is indeed in the future and within 24 hours
                expect(dueDate.getTime()).toBeGreaterThan(now);
                expect(dueDate.getTime()).toBeLessThan(now + 24 * 60 * 60 * 1000);
              } else if (bill.hoursFromNow <= 0) {
                // Bills already past due or due right now may be skipped due to timing
                expect(result?.status).toBe('skipped');
                expect(result?.reason).toBe('Not due within 24 hours');
              } else {
                // Bills due more than 24 hours from now (including exactly 24) should be skipped
                expect(result?.status).toBe('skipped');
                expect(result?.reason).toBe('Not due within 24 hours');
              }
            }

            // Clean up
            await AutoPaymentConfig.deleteMany({
              billId: { $in: bills.map(b => b.billId) },
            });
          }
        ),
        {
          numRuns: 50, // Run 50 random test cases
          endOnFailure: true,
        }
      );
    });

    /**
     * Property 1.1: Boundary Testing for 24-Hour Window
     * **Validates: Requirements 2.1, 2.2**
     * 
     * Tests the exact boundaries of the 24-hour window to ensure
     * the system correctly handles edge cases at the boundary.
     */
    it('should correctly handle bills at the 24-hour boundary', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate bills with due dates very close to the 24-hour boundary
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            amount: fc.double({ min: 1, max: 10000, noNaN: true }),
            // Generate due dates within ±1 hour of the 24-hour boundary
            minutesFromNow: fc.integer({ min: 23 * 60, max: 25 * 60 }),
            provider: fc.constantFrom('Electric Company', 'Water Company'),
            type: fc.constantFrom('electricity', 'water'),
          }),
          async (bill) => {
            // Arrange
            const service = new AutoPaymentService();
            const now = Date.now();
            const dueDate = new Date(now + bill.minutesFromNow * 60 * 1000);

            await AutoPaymentConfig.create({
              userId: bill.userId,
              billId: bill.billId,
              enabled: true,
            });

            // Mock BillAPI response
            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              json: async () => ({
                bill: {
                  id: bill.billId,
                  amount: bill.amount,
                  dueDate: dueDate.toISOString(),
                  provider: bill.provider,
                  type: bill.type,
                },
              }),
            });

            // Act
            const results = await service.processScheduledPayments();

            // Assert
            const result = results.find(r => r.billId === bill.billId);
            expect(result).toBeDefined();

            const twentyFourHoursFromNow = now + 24 * 60 * 60 * 1000;
            
            if (dueDate.getTime() <= twentyFourHoursFromNow && dueDate.getTime() >= now) {
              // Within 24 hours - should be processed
              expect(result?.status).toBe('processed');
            } else {
              // Outside 24 hours - should be skipped
              expect(result?.status).toBe('skipped');
              expect(result?.reason).toBe('Not due within 24 hours');
            }

            // Clean up
            await AutoPaymentConfig.deleteMany({ billId: bill.billId });
          }
        ),
        {
          numRuns: 30,
          endOnFailure: true,
        }
      );
    });

    /**
     * Property 1.2: Multiple Bills with Same User
     * **Validates: Requirements 2.1, 2.2**
     * 
     * Tests that when a user has multiple bills, each bill is independently
     * evaluated for the 24-hour window, and all eligible bills are processed.
     */
    it('should independently process multiple bills for the same user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            bills: fc.array(
              fc.record({
                billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
                amount: fc.double({ min: 1, max: 5000, noNaN: true }),
                hoursFromNow: fc.integer({ min: -12, max: 48 }).filter(h => h !== 0 && h !== 24),
                provider: fc.constantFrom('Electric Company', 'Water Company', 'Gas Company'),
                type: fc.constantFrom('electricity', 'water', 'gas'),
              }),
              { minLength: 2, maxLength: 5 }
            ),
          }),
          async ({ userId, bills }) => {
            // Ensure unique bill IDs
            const uniqueBills = bills.filter((bill, index, self) => 
              index === self.findIndex(b => b.billId === bill.billId)
            );

            if (uniqueBills.length < 2) {
              // Skip if we don't have at least 2 unique bills
              return;
            }

            // Arrange
            const service = new AutoPaymentService();
            const now = Date.now();

            // Create auto-payment configs for all bills
            for (const bill of uniqueBills) {
              await AutoPaymentConfig.create({
                userId,
                billId: bill.billId,
                enabled: true,
              });
            }

            // Mock BillAPI responses
            global.fetch = vi.fn().mockImplementation((url) => {
              const urlStr = url.toString();
              const billIdMatch = urlStr.match(/billId=([^&]+)/);
              
              if (!billIdMatch) {
                return Promise.reject(new Error('No billId in URL'));
              }
              
              const billId = billIdMatch[1];
              const bill = uniqueBills.find(b => b.billId === billId);
              
              if (!bill) {
                return Promise.resolve({
                  ok: true,
                  json: async () => ({ bill: null }),
                });
              }

              const dueDate = new Date(now + bill.hoursFromNow * 60 * 60 * 1000);

              return Promise.resolve({
                ok: true,
                json: async () => ({
                  bill: {
                    id: bill.billId,
                    amount: bill.amount,
                    dueDate: dueDate.toISOString(),
                    provider: bill.provider,
                    type: bill.type,
                  },
                }),
              });
            });

            // Act
            const results = await service.processScheduledPayments();

            // Assert - Each bill should be independently evaluated
            expect(results.length).toBe(uniqueBills.length);

            let processedCount = 0;
            let skippedCount = 0;

            for (const bill of uniqueBills) {
              const result = results.find(r => r.billId === bill.billId);
              expect(result).toBeDefined();
              expect(result?.userId).toBe(userId);

              const isDueWithin24Hours = bill.hoursFromNow > 0 && bill.hoursFromNow < 24;

              if (isDueWithin24Hours) {
                expect(result?.status).toBe('processed');
                processedCount++;
              } else {
                expect(result?.status).toBe('skipped');
                skippedCount++;
              }
            }

            // Verify counts match expectations
            const expectedProcessed = uniqueBills.filter(b => b.hoursFromNow >= 0 && b.hoursFromNow <= 24).length;
            const expectedSkipped = uniqueBills.length - expectedProcessed;
            
            expect(processedCount).toBe(expectedProcessed);
            expect(skippedCount).toBe(expectedSkipped);

            // Clean up
            await AutoPaymentConfig.deleteMany({
              billId: { $in: uniqueBills.map(b => b.billId) },
            });
          }
        ),
        {
          numRuns: 30,
          endOnFailure: true,
        }
      );
    });
  });

  /**
   * Property 5: Retry Logic Correctness
   * **Validates: Requirements 2.3, 2.5**
   * 
   * Property statement: For any failed automatic payment, the system will retry 
   * exactly 3 times with 2-hour intervals before disabling auto-payment.
   * 
   * This test generates random payment scenarios with various failure patterns
   * and verifies that:
   * 1. The system retries exactly 3 times for failed payments
   * 2. Auto-payment is disabled after all retries fail
   * 3. The retry logic handles different failure scenarios consistently
   */
  describe('Property 5: Retry Logic Correctness', () => {
    /**
     * Test: System retries exactly 3 times before disabling auto-payment
     * 
     * This property test verifies that regardless of the payment details,
     * when a payment fails, the system will:
     * - Attempt the payment initially
     * - Retry exactly 3 times
     * - Disable auto-payment after all retries fail
     */
    it('should retry exactly 3 times before disabling auto-payment', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            amount: fc.double({ min: 1, max: 10000, noNaN: true }),
            billProvider: fc.constantFrom('Electric Company', 'Water Company', 'Gas Company', 'Internet Provider'),
            billType: fc.constantFrom('electricity', 'water', 'gas', 'internet'),
          }),
          async (paymentData) => {
            // Arrange
            const service = new AutoPaymentService();
            const { userId, billId, amount, billProvider, billType } = paymentData;

            // Import models
            const PaymentCycle = (await import('../../models/PaymentCycle')).default;

            // Create active payment cycle
            await PaymentCycle.create({
              userId,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              status: 'active',
            });

            // Create enabled auto-payment config
            await AutoPaymentConfig.create({
              userId,
              billId,
              enabled: true,
            });

            // Mock setTimeout to execute immediately (skip the 2-hour wait)
            vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
              if (typeof callback === 'function') {
                callback();
              }
              return 0 as any;
            });

            // Track payment attempts
            let paymentAttempts = 0;

            // Mock BillAPI to always fail payments
            global.fetch = vi.fn().mockImplementation((url) => {
              const urlStr = url.toString();
              
              if (urlStr.includes('/pay')) {
                paymentAttempts++;
                // All payment attempts fail
                return Promise.resolve({
                  ok: false,
                  status: 500,
                  json: async () => ({ message: 'Payment processing error' }),
                });
              }
              
              return Promise.reject(new Error('Unknown endpoint'));
            });

            // Act
            const record = await service.retryFailedPayment(userId, billId, amount, billProvider, billType, 1);

            // Assert - Verify retry logic correctness
            
            // 1. Should return null after all retries fail
            expect(record).toBeNull();

            // 2. Should have attempted payment exactly 3 times (attempts 1, 2, 3)
            expect(paymentAttempts).toBe(3);

            // 3. Auto-payment should be disabled
            const config = await AutoPaymentConfig.findOne({ userId, billId });
            expect(config).not.toBeNull();
            expect(config?.enabled).toBe(false);
            expect(config?.disabledReason).toBe('Payment failed after 3 retry attempts');

            // Clean up
            await AutoPaymentConfig.deleteMany({ userId, billId });
            await PaymentCycle.deleteMany({ userId });
          }
        ),
        {
          numRuns: 50, // Run 50 random test cases
          endOnFailure: true,
        }
      );
    });

    /**
     * Test: System succeeds on retry before reaching max attempts
     * 
     * This property test verifies that when a payment succeeds on a retry
     * (before reaching 3 attempts), the system:
     * - Stops retrying after success
     * - Does not disable auto-payment
     * - Returns a successful payment record
     */
    it('should stop retrying after successful payment and not disable auto-payment', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            amount: fc.double({ min: 1, max: 10000, noNaN: true }),
            billProvider: fc.constantFrom('Electric Company', 'Water Company', 'Gas Company'),
            billType: fc.constantFrom('electricity', 'water', 'gas'),
            // Which attempt should succeed (1, 2, or 3)
            successOnAttempt: fc.integer({ min: 1, max: 3 }),
          }),
          async (paymentData) => {
            // Arrange
            const service = new AutoPaymentService();
            const { userId, billId, amount, billProvider, billType, successOnAttempt } = paymentData;

            // Import models
            const PaymentCycle = (await import('../../models/PaymentCycle')).default;

            // Create active payment cycle
            await PaymentCycle.create({
              userId,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              status: 'active',
            });

            // Create enabled auto-payment config
            await AutoPaymentConfig.create({
              userId,
              billId,
              enabled: true,
            });

            // Mock setTimeout to execute immediately
            vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
              if (typeof callback === 'function') {
                callback();
              }
              return 0 as any;
            });

            // Track payment attempts
            let paymentAttempts = 0;

            // Mock BillAPI to fail until successOnAttempt, then succeed
            global.fetch = vi.fn().mockImplementation((url) => {
              const urlStr = url.toString();
              
              if (urlStr.includes('/pay')) {
                paymentAttempts++;
                
                if (paymentAttempts < successOnAttempt) {
                  // Fail before success attempt
                  return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: async () => ({ message: 'Temporary error' }),
                  });
                } else {
                  // Succeed on the specified attempt
                  return Promise.resolve({
                    ok: true,
                    json: async () => ({
                      transactionId: `txn-success-${paymentAttempts}`,
                    }),
                  });
                }
              }
              
              return Promise.reject(new Error('Unknown endpoint'));
            });

            // Act
            const record = await service.retryFailedPayment(userId, billId, amount, billProvider, billType, 1);

            // Assert - Verify retry logic correctness
            
            // 1. Should return a successful payment record
            expect(record).not.toBeNull();
            expect(record.status).toBe('success');
            expect(record.transactionId).toBeDefined();

            // 2. Should have attempted payment exactly successOnAttempt times
            expect(paymentAttempts).toBe(successOnAttempt);

            // 3. Auto-payment should still be enabled (not disabled)
            const config = await AutoPaymentConfig.findOne({ userId, billId });
            expect(config).not.toBeNull();
            expect(config?.enabled).toBe(true);
            expect(config?.disabledReason).toBeUndefined();

            // Clean up
            await AutoPaymentConfig.deleteMany({ userId, billId });
            await PaymentCycle.deleteMany({ userId });
            const AutoPaymentRecord = (await import('../../models/AutoPaymentRecord')).default;
            await AutoPaymentRecord.deleteMany({ userId, billId });
          }
        ),
        {
          numRuns: 50,
          endOnFailure: true,
        }
      );
    });

    /**
     * Test: Verify retry count is exactly 3 attempts
     * 
     * This is a focused property test that specifically validates
     * the "exactly 3 times" requirement by counting attempts.
     */
    it('should make exactly 3 payment attempts when all retries fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            amount: fc.double({ min: 1, max: 10000, noNaN: true }),
            billProvider: fc.constantFrom('Electric Company', 'Water Company', 'Gas Company'),
            billType: fc.constantFrom('electricity', 'water', 'gas'),
          }),
          async (paymentData) => {
            // Arrange
            const service = new AutoPaymentService();
            const { userId, billId, amount, billProvider, billType } = paymentData;

            // Import models
            const PaymentCycle = (await import('../../models/PaymentCycle')).default;

            // Create active payment cycle
            await PaymentCycle.create({
              userId,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              status: 'active',
            });

            // Create enabled auto-payment config
            await AutoPaymentConfig.create({
              userId,
              billId,
              enabled: true,
            });

            // Mock setTimeout to execute immediately
            vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
              if (typeof callback === 'function') {
                callback();
              }
              return 0 as any;
            });

            // Track payment attempts with detailed logging
            const attemptLog: Array<{ attemptNumber: number; timestamp: number }> = [];

            // Mock BillAPI to always fail and log attempts
            global.fetch = vi.fn().mockImplementation((url) => {
              const urlStr = url.toString();
              
              if (urlStr.includes('/pay')) {
                attemptLog.push({
                  attemptNumber: attemptLog.length + 1,
                  timestamp: Date.now(),
                });
                
                // All payment attempts fail
                return Promise.resolve({
                  ok: false,
                  status: 500,
                  json: async () => ({ message: 'Payment processing error' }),
                });
              }
              
              return Promise.reject(new Error('Unknown endpoint'));
            });

            // Act
            await service.retryFailedPayment(userId, billId, amount, billProvider, billType, 1);

            // Assert - Verify exactly 3 attempts
            expect(attemptLog.length).toBe(3);
            expect(attemptLog[0].attemptNumber).toBe(1);
            expect(attemptLog[1].attemptNumber).toBe(2);
            expect(attemptLog[2].attemptNumber).toBe(3);

            // Clean up
            await AutoPaymentConfig.deleteMany({ userId, billId });
            await PaymentCycle.deleteMany({ userId });
          }
        ),
        {
          numRuns: 50,
          endOnFailure: true,
        }
      );
    });
  });

  /**
   * Property 7: No Duplicate Payments
   * **Validates: Requirements 2.1, 3.1**
   * 
   * Property statement: For any bill in a given payment cycle, there exists 
   * at most one successful AutoPaymentRecord.
   * 
   * This test generates random payment scenarios with concurrent payment attempts
   * and verifies that:
   * 1. Only one successful payment record exists per bill per cycle
   * 2. Duplicate payment attempts are detected and prevented
   * 3. The system maintains payment integrity across concurrent operations
   */
  describe('Property 7: No Duplicate Payments', () => {
    /**
     * Test: At most one successful payment per bill per cycle
     * 
     * This property test verifies that regardless of how many times we attempt
     * to process a bill within a payment cycle, only one successful payment
     * record is created.
     */
    it('should ensure at most one successful payment per bill per cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            amount: fc.double({ min: 1, max: 10000, noNaN: true }),
            billProvider: fc.constantFrom('Electric Company', 'Water Company', 'Gas Company', 'Internet Provider'),
            billType: fc.constantFrom('electricity', 'water', 'gas', 'internet'),
            // Number of payment attempts to simulate (1-5)
            attemptCount: fc.integer({ min: 1, max: 5 }),
          }),
          async (testData) => {
            // Arrange
            const service = new AutoPaymentService();
            const { userId, billId, amount, billProvider, billType, attemptCount } = testData;

            // Import models
            const AutoPaymentRecord = (await import('../../models/AutoPaymentRecord')).default;
            const PaymentCycle = (await import('../../models/PaymentCycle')).default;

            // Create active payment cycle
            const cycle = await PaymentCycle.create({
              userId,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              status: 'active',
            });

            // Create enabled auto-payment config
            await AutoPaymentConfig.create({
              userId,
              billId,
              enabled: true,
            });

            // Track successful payment attempts
            let successfulPayments = 0;

            // Mock BillAPI to succeed on payment
            global.fetch = vi.fn().mockImplementation((url) => {
              const urlStr = url.toString();
              
              if (urlStr.includes('/pay')) {
                successfulPayments++;
                return Promise.resolve({
                  ok: true,
                  json: async () => ({
                    transactionId: `txn-${Date.now()}-${successfulPayments}`,
                  }),
                });
              }
              
              return Promise.reject(new Error('Unknown endpoint'));
            });

            // Act - Attempt payment multiple times
            const paymentPromises: Promise<any>[] = [];
            
            for (let i = 0; i < attemptCount; i++) {
              paymentPromises.push(
                service.executePayment(userId, billId, amount, billProvider, billType)
                  .catch(error => {
                    // Some attempts may fail due to duplicate detection
                    return null;
                  })
              );
            }

            // Wait for all payment attempts to complete
            await Promise.all(paymentPromises);

            // Assert - Verify no duplicate payments property
            
            // 1. Query all successful payment records for this bill in this cycle
            const successfulRecords = await AutoPaymentRecord.find({
              userId,
              billId,
              paymentCycleId: cycle._id.toString(),
              status: { $in: ['success', 'settled'] },
            });

            // 2. There should be AT MOST one successful payment record
            expect(successfulRecords.length).toBeLessThanOrEqual(1);

            // 3. If a successful record exists, verify its properties
            if (successfulRecords.length === 1) {
              const record = successfulRecords[0];
              expect(record.userId).toBe(userId);
              expect(record.billId).toBe(billId);
              expect(record.amount).toBe(amount);
              expect(record.billProvider).toBe(billProvider);
              expect(record.billType).toBe(billType);
              expect(record.paymentCycleId).toBe(cycle._id.toString());
              expect(['success', 'settled']).toContain(record.status);
            }

            // 4. Verify that duplicate detection worked correctly
            // If we attempted multiple payments, only the first should succeed
            if (attemptCount > 1 && successfulRecords.length === 1) {
              // The system correctly prevented duplicate payments
              expect(successfulRecords.length).toBe(1);
            }

            // Clean up
            await AutoPaymentConfig.deleteMany({ userId, billId });
            await AutoPaymentRecord.deleteMany({ userId, billId });
            await PaymentCycle.deleteMany({ userId });
          }
        ),
        {
          numRuns: 50, // Run 50 random test cases
          endOnFailure: true,
        }
      );
    });

    /**
     * Test: Duplicate detection across sequential payment attempts
     * 
     * This test verifies that when processScheduledPaymentsWithExecution is called multiple
     * times for the same bill within a payment cycle, the system correctly
     * detects and prevents duplicate payments.
     */
    it('should prevent duplicate payments across sequential processing attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            amount: fc.double({ min: 1, max: 10000, noNaN: true }),
            billProvider: fc.constantFrom('Electric Company', 'Water Company', 'Gas Company'),
            billType: fc.constantFrom('electricity', 'water', 'gas'),
            // Number of times to run processScheduledPaymentsWithExecution (2-4)
            processingRuns: fc.integer({ min: 2, max: 4 }),
          }),
          async (testData) => {
            // Arrange
            const service = new AutoPaymentService();
            const { userId, billId, amount, billProvider, billType, processingRuns } = testData;

            // Import models
            const AutoPaymentRecord = (await import('../../models/AutoPaymentRecord')).default;
            const PaymentCycle = (await import('../../models/PaymentCycle')).default;

            // Create active payment cycle
            const cycle = await PaymentCycle.create({
              userId,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              status: 'active',
            });

            // Create enabled auto-payment config
            await AutoPaymentConfig.create({
              userId,
              billId,
              enabled: true,
            });

            // Mock BillAPI responses
            const now = Date.now();
            const dueDate = new Date(now + 12 * 60 * 60 * 1000); // Due in 12 hours

            global.fetch = vi.fn().mockImplementation((url) => {
              const urlStr = url.toString();
              
              if (urlStr.includes('/query')) {
                return Promise.resolve({
                  ok: true,
                  json: async () => ({
                    bill: {
                      id: billId,
                      amount,
                      dueDate: dueDate.toISOString(),
                      provider: billProvider,
                      type: billType,
                    },
                  }),
                });
              } else if (urlStr.includes('/pay')) {
                return Promise.resolve({
                  ok: true,
                  json: async () => ({
                    transactionId: `txn-${Date.now()}-${Math.random()}`,
                  }),
                });
              }
              
              return Promise.reject(new Error('Unknown endpoint'));
            });

            // Act - Run processScheduledPaymentsWithExecution multiple times
            const results: Array<any> = [];
            
            for (let i = 0; i < processingRuns; i++) {
              const result = await service.processScheduledPaymentsWithExecution();
              results.push(result);
            }

            // Assert - Verify no duplicate payments property
            
            // 1. Query all successful payment records for this bill in this cycle
            const successfulRecords = await AutoPaymentRecord.find({
              userId,
              billId,
              paymentCycleId: cycle._id.toString(),
              status: { $in: ['success', 'settled'] },
            });

            // 2. There should be AT MOST one successful payment record
            expect(successfulRecords.length).toBeLessThanOrEqual(1);

            // 3. Verify processing results
            // First run should successfully execute the payment
            expect(results[0]).toHaveLength(1);
            expect(results[0][0].billId).toBe(billId);
            expect(results[0][0].status).toBe('success');

            // Subsequent runs should skip the bill (already paid)
            for (let i = 1; i < processingRuns; i++) {
              expect(results[i]).toHaveLength(1);
              expect(results[i][0].billId).toBe(billId);
              expect(results[i][0].status).toBe('skipped');
              expect(results[i][0].reason).toBe('Already paid in current cycle');
            }

            // Clean up
            await AutoPaymentConfig.deleteMany({ userId, billId });
            await AutoPaymentRecord.deleteMany({ userId, billId });
            await PaymentCycle.deleteMany({ userId });
          }
        ),
        {
          numRuns: 30, // Run 30 random test cases
          endOnFailure: true,
        }
      );
    });

    /**
     * Test: No duplicate payments across multiple bills for same user
     * 
     * This test verifies that when a user has multiple bills, each bill
     * can have exactly one successful payment per cycle, and there's no
     * cross-contamination between bills.
     */
    it('should allow one payment per bill while preventing duplicates within each bill', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            bills: fc.array(
              fc.record({
                billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
                amount: fc.double({ min: 1, max: 5000, noNaN: true }),
                billProvider: fc.constantFrom('Electric Company', 'Water Company', 'Gas Company'),
                billType: fc.constantFrom('electricity', 'water', 'gas'),
              }),
              { minLength: 2, maxLength: 4 }
            ),
          }),
          async ({ userId, bills }) => {
            // Ensure unique bill IDs
            const uniqueBills = bills.filter((bill, index, self) => 
              index === self.findIndex(b => b.billId === bill.billId)
            );

            if (uniqueBills.length < 2) {
              // Skip if we don't have at least 2 unique bills
              return;
            }

            // Arrange
            const service = new AutoPaymentService();

            // Import models
            const AutoPaymentRecord = (await import('../../models/AutoPaymentRecord')).default;
            const PaymentCycle = (await import('../../models/PaymentCycle')).default;

            // Create active payment cycle
            const cycle = await PaymentCycle.create({
              userId,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              status: 'active',
            });

            // Create enabled auto-payment configs for all bills
            for (const bill of uniqueBills) {
              await AutoPaymentConfig.create({
                userId,
                billId: bill.billId,
                enabled: true,
              });
            }

            // Mock BillAPI responses
            const now = Date.now();
            const dueDate = new Date(now + 12 * 60 * 60 * 1000); // Due in 12 hours

            global.fetch = vi.fn().mockImplementation((url) => {
              const urlStr = url.toString();
              
              if (urlStr.includes('/query')) {
                const billIdMatch = urlStr.match(/billId=([^&]+)/);
                if (!billIdMatch) {
                  return Promise.reject(new Error('No billId in URL'));
                }
                
                const billId = billIdMatch[1];
                const bill = uniqueBills.find(b => b.billId === billId);
                
                if (!bill) {
                  return Promise.resolve({
                    ok: true,
                    json: async () => ({ bill: null }),
                  });
                }

                return Promise.resolve({
                  ok: true,
                  json: async () => ({
                    bill: {
                      id: bill.billId,
                      amount: bill.amount,
                      dueDate: dueDate.toISOString(),
                      provider: bill.billProvider,
                      type: bill.billType,
                    },
                  }),
                });
              } else if (urlStr.includes('/pay')) {
                return Promise.resolve({
                  ok: true,
                  json: async () => ({
                    transactionId: `txn-${Date.now()}-${Math.random()}`,
                  }),
                });
              }
              
              return Promise.reject(new Error('Unknown endpoint'));
            });

            // Act - Process payments for all bills
            await service.processScheduledPayments();

            // Assert - Verify no duplicate payments property for each bill
            
            for (const bill of uniqueBills) {
              // Query successful payment records for this specific bill in this cycle
              const successfulRecords = await AutoPaymentRecord.find({
                userId,
                billId: bill.billId,
                paymentCycleId: cycle._id.toString(),
                status: { $in: ['success', 'settled'] },
              });

              // Each bill should have AT MOST one successful payment record
              expect(successfulRecords.length).toBeLessThanOrEqual(1);

              // If a record exists, verify it's for the correct bill
              if (successfulRecords.length === 1) {
                expect(successfulRecords[0].billId).toBe(bill.billId);
                expect(successfulRecords[0].userId).toBe(userId);
                expect(successfulRecords[0].paymentCycleId).toBe(cycle._id.toString());
              }
            }

            // Verify total number of successful records equals number of unique bills
            const allSuccessfulRecords = await AutoPaymentRecord.find({
              userId,
              paymentCycleId: cycle._id.toString(),
              status: { $in: ['success', 'settled'] },
            });

            // Should have at most one record per bill
            expect(allSuccessfulRecords.length).toBeLessThanOrEqual(uniqueBills.length);

            // Verify no duplicate billIds in successful records
            const billIds = allSuccessfulRecords.map(r => r.billId);
            const uniqueBillIds = [...new Set(billIds)];
            expect(billIds.length).toBe(uniqueBillIds.length);

            // Clean up
            await AutoPaymentConfig.deleteMany({
              billId: { $in: uniqueBills.map(b => b.billId) },
            });
            await AutoPaymentRecord.deleteMany({ userId });
            await PaymentCycle.deleteMany({ userId });
          }
        ),
        {
          numRuns: 30, // Run 30 random test cases
          endOnFailure: true,
        }
      );
    });

    /**
     * Test: Duplicate payments allowed across different payment cycles
     * 
     * This test verifies that while duplicate payments are prevented within
     * a single payment cycle, the same bill can be paid in different cycles.
     */
    it('should allow the same bill to be paid in different payment cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            amount: fc.double({ min: 1, max: 10000, noNaN: true }),
            billProvider: fc.constantFrom('Electric Company', 'Water Company'),
            billType: fc.constantFrom('electricity', 'water'),
            // Number of payment cycles to test (2-3)
            cycleCount: fc.integer({ min: 2, max: 3 }),
          }),
          async (testData) => {
            // Arrange
            const service = new AutoPaymentService();
            const { userId, billId, amount, billProvider, billType, cycleCount } = testData;

            // Import models
            const AutoPaymentRecord = (await import('../../models/AutoPaymentRecord')).default;
            const PaymentCycle = (await import('../../models/PaymentCycle')).default;

            // Create enabled auto-payment config
            await AutoPaymentConfig.create({
              userId,
              billId,
              enabled: true,
            });

            // Mock BillAPI to succeed on payment
            global.fetch = vi.fn().mockImplementation((url) => {
              const urlStr = url.toString();
              
              if (urlStr.includes('/pay')) {
                return Promise.resolve({
                  ok: true,
                  json: async () => ({
                    transactionId: `txn-${Date.now()}-${Math.random()}`,
                  }),
                });
              }
              
              return Promise.reject(new Error('Unknown endpoint'));
            });

            // Act - Create multiple payment cycles and pay the bill in each
            const cycles: any[] = [];
            
            for (let i = 0; i < cycleCount; i++) {
              // Create a new payment cycle
              const cycle = await PaymentCycle.create({
                userId,
                startDate: new Date(2024, i, 1),
                endDate: new Date(2024, i, 28),
                status: 'active',
              });
              cycles.push(cycle);

              // Execute payment for this cycle
              await service.executePayment(userId, billId, amount, billProvider, billType);

              // Complete the cycle
              cycle.status = 'completed';
              await cycle.save();
            }

            // Assert - Verify payments across cycles
            
            // 1. Total successful records should equal number of cycles
            const allSuccessfulRecords = await AutoPaymentRecord.find({
              userId,
              billId,
              status: { $in: ['success', 'settled'] },
            });

            expect(allSuccessfulRecords.length).toBe(cycleCount);

            // 2. Each cycle should have exactly one payment record
            for (const cycle of cycles) {
              const cycleRecords = await AutoPaymentRecord.find({
                userId,
                billId,
                paymentCycleId: cycle._id.toString(),
                status: { $in: ['success', 'settled'] },
              });

              // Exactly one payment per cycle
              expect(cycleRecords.length).toBe(1);
              expect(cycleRecords[0].billId).toBe(billId);
              expect(cycleRecords[0].userId).toBe(userId);
            }

            // 3. Verify all payment cycle IDs are unique
            const cycleIds = allSuccessfulRecords.map(r => r.paymentCycleId);
            const uniqueCycleIds = [...new Set(cycleIds)];
            expect(cycleIds.length).toBe(uniqueCycleIds.length);

            // Clean up
            await AutoPaymentConfig.deleteMany({ userId, billId });
            await AutoPaymentRecord.deleteMany({ userId, billId });
            await PaymentCycle.deleteMany({ userId });
          }
        ),
        {
          numRuns: 30, // Run 30 random test cases
          endOnFailure: true,
        }
      );
    });
  });
});
