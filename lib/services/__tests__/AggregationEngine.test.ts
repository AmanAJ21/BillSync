import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AggregationEngine } from '../AggregationEngine';
import AutoPaymentRecord from '../../models/AutoPaymentRecord';
import ConsolidatedBill from '../../models/ConsolidatedBill';
import PaymentCycle from '../../models/PaymentCycle';
import { clearDatabase } from '../../test/setup';

describe('AggregationEngine', () => {
  let aggregationEngine: AggregationEngine;

  beforeEach(async () => {
    await clearDatabase();
    aggregationEngine = new AggregationEngine();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('generateConsolidatedBill', () => {
    it('should generate a consolidated bill with correct total amount', async () => {
      // Create a payment cycle
      const paymentCycle = await PaymentCycle.create({
        userId: 'user123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create auto payment records
      const record1 = await AutoPaymentRecord.create({
        userId: 'user123',
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn1',
        billProvider: 'Provider A',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: paymentCycle._id.toString(),
      });

      const record2 = await AutoPaymentRecord.create({
        userId: 'user123',
        billId: 'bill2',
        amount: 200,
        paymentDate: new Date('2024-01-20'),
        transactionId: 'txn2',
        billProvider: 'Provider B',
        billType: 'water',
        status: 'success',
        paymentCycleId: paymentCycle._id.toString(),
      });

      // Generate consolidated bill
      const consolidatedBill = await aggregationEngine.generateConsolidatedBill(
        'user123',
        paymentCycle._id.toString()
      );

      // Assertions
      expect(consolidatedBill).not.toBeNull();
      expect(consolidatedBill!.userId).toBe('user123');
      expect(consolidatedBill!.paymentCycleId).toBe(paymentCycle._id.toString());
      expect(consolidatedBill!.totalAmount).toBe(300); // 100 + 200
      expect(consolidatedBill!.autoPaymentRecords).toHaveLength(2);
      expect(consolidatedBill!.autoPaymentRecords).toContain(record1._id.toString());
      expect(consolidatedBill!.autoPaymentRecords).toContain(record2._id.toString());
      expect(consolidatedBill!.status).toBe('pending');
      expect(consolidatedBill!.cycleStartDate).toEqual(paymentCycle.startDate);
      expect(consolidatedBill!.cycleEndDate).toEqual(paymentCycle.endDate);
    });

    it('should return null when no auto payment records exist', async () => {
      // Create a payment cycle with no records
      const paymentCycle = await PaymentCycle.create({
        userId: 'user123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Generate consolidated bill
      const consolidatedBill = await aggregationEngine.generateConsolidatedBill(
        'user123',
        paymentCycle._id.toString()
      );

      // Assertion - Requirement 4.6: Skip generation if no records exist
      expect(consolidatedBill).toBeNull();
    });

    it('should include only successful and settled records', async () => {
      // Create a payment cycle
      const paymentCycle = await PaymentCycle.create({
        userId: 'user123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create auto payment records with different statuses
      const successRecord = await AutoPaymentRecord.create({
        userId: 'user123',
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn1',
        billProvider: 'Provider A',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: paymentCycle._id.toString(),
      });

      const settledRecord = await AutoPaymentRecord.create({
        userId: 'user123',
        billId: 'bill2',
        amount: 150,
        paymentDate: new Date('2024-01-18'),
        transactionId: 'txn2',
        billProvider: 'Provider B',
        billType: 'water',
        status: 'settled',
        paymentCycleId: paymentCycle._id.toString(),
      });

      // Create a failed record that should be excluded
      await AutoPaymentRecord.create({
        userId: 'user123',
        billId: 'bill3',
        amount: 50,
        paymentDate: new Date('2024-01-20'),
        transactionId: 'txn3',
        billProvider: 'Provider C',
        billType: 'mobile',
        status: 'failed',
        paymentCycleId: paymentCycle._id.toString(),
      });

      // Generate consolidated bill
      const consolidatedBill = await aggregationEngine.generateConsolidatedBill(
        'user123',
        paymentCycle._id.toString()
      );

      // Assertions
      expect(consolidatedBill).not.toBeNull();
      expect(consolidatedBill!.totalAmount).toBe(250); // 100 + 150, excluding failed
      expect(consolidatedBill!.autoPaymentRecords).toHaveLength(2);
      expect(consolidatedBill!.autoPaymentRecords).toContain(successRecord._id.toString());
      expect(consolidatedBill!.autoPaymentRecords).toContain(settledRecord._id.toString());
    });

    it('should throw error when userId is missing', async () => {
      await expect(
        aggregationEngine.generateConsolidatedBill('', 'cycle123')
      ).rejects.toThrow('User ID is required');
    });

    it('should throw error when paymentCycleId is missing', async () => {
      await expect(
        aggregationEngine.generateConsolidatedBill('user123', '')
      ).rejects.toThrow('Payment cycle ID is required');
    });

    it('should throw error when payment cycle not found', async () => {
      await expect(
        aggregationEngine.generateConsolidatedBill('user123', '507f1f77bcf86cd799439011')
      ).rejects.toThrow('Payment cycle 507f1f77bcf86cd799439011 not found');
    });

    it('should throw error when payment cycle does not belong to user', async () => {
      // Create a payment cycle for a different user
      const paymentCycle = await PaymentCycle.create({
        userId: 'user456',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      await expect(
        aggregationEngine.generateConsolidatedBill('user123', paymentCycle._id.toString())
      ).rejects.toThrow('Payment cycle does not belong to the specified user');
    });

    it('should calculate correct total for multiple records', async () => {
      // Create a payment cycle
      const paymentCycle = await PaymentCycle.create({
        userId: 'user123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create multiple auto payment records
      const amounts = [100, 250, 75, 300, 125];
      for (let i = 0; i < amounts.length; i++) {
        await AutoPaymentRecord.create({
          userId: 'user123',
          billId: `bill${i}`,
          amount: amounts[i],
          paymentDate: new Date('2024-01-15'),
          transactionId: `txn${i}`,
          billProvider: `Provider ${i}`,
          billType: 'electricity',
          status: 'success',
          paymentCycleId: paymentCycle._id.toString(),
        });
      }

      // Generate consolidated bill
      const consolidatedBill = await aggregationEngine.generateConsolidatedBill(
        'user123',
        paymentCycle._id.toString()
      );

      // Assertions - Requirement 4.3: Calculate total by summing all amounts
      const expectedTotal = amounts.reduce((sum, amount) => sum + amount, 0);
      expect(consolidatedBill).not.toBeNull();
      expect(consolidatedBill!.totalAmount).toBe(expectedTotal);
      expect(consolidatedBill!.autoPaymentRecords).toHaveLength(amounts.length);
    });
  });
});
