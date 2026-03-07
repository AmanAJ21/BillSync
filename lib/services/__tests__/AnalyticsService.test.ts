import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnalyticsService } from '../AnalyticsService';
import AutoPaymentConfig from '../../models/AutoPaymentConfig';
import AutoPaymentRecord from '../../models/AutoPaymentRecord';
import PaymentCycle from '../../models/PaymentCycle';
import { clearDatabase } from '../../test/setup';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let testUserId: string;

  beforeEach(async () => {
    await clearDatabase();
    
    service = new AnalyticsService();
    testUserId = 'user-analytics-123';
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('getAutoPaymentAnalytics', () => {
    it('should calculate total amount in current cycle', async () => {
      // Create active payment cycle
      const cycle = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create payment records
      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-1',
        amount: 100.50,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn-1',
        billProvider: 'Electric Company',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-2',
        amount: 75.25,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn-2',
        billProvider: 'Water Company',
        billType: 'water',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      const analytics = await service.getAutoPaymentAnalytics(testUserId);

      expect(analytics.currentCycle.totalAmount).toBe(175.75);
      expect(analytics.currentCycle.paymentCount).toBe(2);
    });

    it('should count enabled auto-payment configurations', async () => {
      // Create active payment cycle
      await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create enabled configs
      await AutoPaymentConfig.create({
        userId: testUserId,
        billId: 'bill-1',
        enabled: true,
      });

      await AutoPaymentConfig.create({
        userId: testUserId,
        billId: 'bill-2',
        enabled: true,
      });

      await AutoPaymentConfig.create({
        userId: testUserId,
        billId: 'bill-3',
        enabled: false,
      });

      const analytics = await service.getAutoPaymentAnalytics(testUserId);

      expect(analytics.enabledConfigs).toBe(2);
    });

    it('should group amounts by bill type', async () => {
      // Create active payment cycle
      const cycle = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create payment records with different bill types
      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-1',
        amount: 100.00,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn-1',
        billProvider: 'Electric Company',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-2',
        amount: 50.00,
        paymentDate: new Date('2024-01-12'),
        transactionId: 'txn-2',
        billProvider: 'Electric Company 2',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-3',
        amount: 75.00,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn-3',
        billProvider: 'Water Company',
        billType: 'water',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      const analytics = await service.getAutoPaymentAnalytics(testUserId);

      expect(analytics.billTypeBreakdown).toHaveLength(2);
      
      const electricityBreakdown = analytics.billTypeBreakdown.find(
        (b) => b.billType === 'electricity'
      );
      expect(electricityBreakdown?.amount).toBe(150.00);
      expect(electricityBreakdown?.count).toBe(2);

      const waterBreakdown = analytics.billTypeBreakdown.find(
        (b) => b.billType === 'water'
      );
      expect(waterBreakdown?.amount).toBe(75.00);
      expect(waterBreakdown?.count).toBe(1);
    });

    it('should compare current cycle with previous cycles', async () => {
      // Create completed cycles
      const cycle1 = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2023-11-01'),
        endDate: new Date('2023-11-30'),
        status: 'completed',
      });

      const cycle2 = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2023-12-01'),
        endDate: new Date('2023-12-31'),
        status: 'completed',
      });

      // Create active cycle
      const activeCycle = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Add records to previous cycles
      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-1',
        amount: 100.00,
        paymentDate: new Date('2023-11-10'),
        transactionId: 'txn-nov',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: cycle1._id.toString(),
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-2',
        amount: 200.00,
        paymentDate: new Date('2023-12-10'),
        transactionId: 'txn-dec',
        billProvider: 'Provider',
        billType: 'water',
        status: 'success',
        paymentCycleId: cycle2._id.toString(),
      });

      const analytics = await service.getAutoPaymentAnalytics(testUserId);

      expect(analytics.cycleComparison).toHaveLength(2);
      expect(analytics.cycleComparison[0].totalAmount).toBe(200.00);
      expect(analytics.cycleComparison[1].totalAmount).toBe(100.00);
    });

    it('should exclude failed payments from totals', async () => {
      // Create active payment cycle
      const cycle = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create successful and failed payment records
      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-1',
        amount: 100.00,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn-success',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-2',
        amount: 50.00,
        paymentDate: new Date('2024-01-12'),
        transactionId: 'txn-failed',
        billProvider: 'Provider',
        billType: 'water',
        status: 'failed',
        paymentCycleId: cycle._id.toString(),
      });

      const analytics = await service.getAutoPaymentAnalytics(testUserId);

      // Only successful payment should be counted
      expect(analytics.currentCycle.totalAmount).toBe(100.00);
      expect(analytics.currentCycle.paymentCount).toBe(1);
    });

    it('should include settled payments in totals', async () => {
      // Create active payment cycle
      const cycle = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create settled payment records
      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-1',
        amount: 100.00,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn-settled',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'settled',
        paymentCycleId: cycle._id.toString(),
      });

      const analytics = await service.getAutoPaymentAnalytics(testUserId);

      expect(analytics.currentCycle.totalAmount).toBe(100.00);
      expect(analytics.currentCycle.paymentCount).toBe(1);
    });

    it('should throw error if no active payment cycle exists', async () => {
      await expect(
        service.getAutoPaymentAnalytics(testUserId)
      ).rejects.toThrow('No active payment cycle found for user');
    });

    it('should throw error if userId is missing', async () => {
      await expect(
        service.getAutoPaymentAnalytics('')
      ).rejects.toThrow('User ID is required');
    });

    it('should handle empty current cycle', async () => {
      // Create active payment cycle with no records
      await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      const analytics = await service.getAutoPaymentAnalytics(testUserId);

      expect(analytics.currentCycle.totalAmount).toBe(0);
      expect(analytics.currentCycle.paymentCount).toBe(0);
      expect(analytics.billTypeBreakdown).toHaveLength(0);
    });

    it('should handle multiple bill types correctly', async () => {
      // Create active payment cycle
      const cycle = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      const billTypes = ['electricity', 'water', 'gas', 'mobile', 'internet'];
      
      for (let i = 0; i < billTypes.length; i++) {
        await AutoPaymentRecord.create({
          userId: testUserId,
          billId: `bill-${i}`,
          amount: (i + 1) * 50,
          paymentDate: new Date('2024-01-10'),
          transactionId: `txn-${i}`,
          billProvider: `Provider ${i}`,
          billType: billTypes[i],
          status: 'success',
          paymentCycleId: cycle._id.toString(),
        });
      }

      const analytics = await service.getAutoPaymentAnalytics(testUserId);

      expect(analytics.billTypeBreakdown).toHaveLength(5);
      expect(analytics.currentCycle.totalAmount).toBe(750); // 50+100+150+200+250
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history across all cycles', async () => {
      // Create multiple cycles
      const cycle1 = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2023-12-01'),
        endDate: new Date('2023-12-31'),
        status: 'completed',
      });

      const cycle2 = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Add records to cycles
      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-1',
        amount: 100.00,
        paymentDate: new Date('2023-12-10'),
        transactionId: 'txn-dec',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: cycle1._id.toString(),
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-2',
        amount: 200.00,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn-jan',
        billProvider: 'Provider',
        billType: 'water',
        status: 'success',
        paymentCycleId: cycle2._id.toString(),
      });

      const history = await service.getPaymentHistory(testUserId);

      expect(history).toHaveLength(2);
      expect(history[0].cycle.cycleId).toBe(cycle2._id.toString());
      expect(history[0].payments).toHaveLength(1);
      expect(history[0].totalAmount).toBe(200.00);
      
      expect(history[1].cycle.cycleId).toBe(cycle1._id.toString());
      expect(history[1].payments).toHaveLength(1);
      expect(history[1].totalAmount).toBe(100.00);
    });

    it('should respect limit parameter', async () => {
      // Create 5 cycles
      for (let i = 0; i < 5; i++) {
        await PaymentCycle.create({
          userId: testUserId,
          startDate: new Date(2024, i, 1),
          endDate: new Date(2024, i + 1, 0),
          status: i === 4 ? 'active' : 'completed',
        });
      }

      const history = await service.getPaymentHistory(testUserId, 3);

      expect(history).toHaveLength(3);
    });

    it('should calculate total amount correctly for each cycle', async () => {
      const cycle = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-1',
        amount: 100.00,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn-1',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-2',
        amount: 50.00,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn-2',
        billProvider: 'Provider',
        billType: 'water',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      const history = await service.getPaymentHistory(testUserId);

      expect(history[0].totalAmount).toBe(150.00);
      expect(history[0].paymentCount).toBe(2);
    });

    it('should exclude failed payments from total amount', async () => {
      const cycle = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-1',
        amount: 100.00,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn-success',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: cycle._id.toString(),
      });

      await AutoPaymentRecord.create({
        userId: testUserId,
        billId: 'bill-2',
        amount: 50.00,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn-failed',
        billProvider: 'Provider',
        billType: 'water',
        status: 'failed',
        paymentCycleId: cycle._id.toString(),
      });

      const history = await service.getPaymentHistory(testUserId);

      expect(history[0].totalAmount).toBe(100.00);
      expect(history[0].paymentCount).toBe(2); // Count includes all payments
    });

    it('should throw error if userId is missing', async () => {
      await expect(
        service.getPaymentHistory('')
      ).rejects.toThrow('User ID is required');
    });

    it('should return empty array if user has no cycles', async () => {
      const history = await service.getPaymentHistory(testUserId);

      expect(history).toHaveLength(0);
    });

    it('should sort cycles by start date descending', async () => {
      // Create cycles in random order
      const cycle1 = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'completed',
      });

      const cycle2 = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-31'),
        status: 'active',
      });

      const cycle3 = await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-29'),
        status: 'completed',
      });

      const history = await service.getPaymentHistory(testUserId);

      expect(history).toHaveLength(3);
      expect(history[0].cycle.cycleId).toBe(cycle2._id.toString());
      expect(history[1].cycle.cycleId).toBe(cycle3._id.toString());
      expect(history[2].cycle.cycleId).toBe(cycle1._id.toString());
    });
  });
});
