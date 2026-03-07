import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import ConsolidatedBill from '@/lib/models/ConsolidatedBill';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';
import {
  payConsolidatedBill,
  handlePaymentSuccess,
  handlePaymentFailure,
} from '@/lib/services/ConsolidatedBillPaymentService';

/**
 * Unit tests for Consolidated Bill Payment Service
 * Tests: Successful payment flow, Failed payment and retry, Webhook handling
 */

// Mock Razorpay service
vi.mock('@/lib/services/RazorpayService', () => ({
  createRazorpayOrder: vi.fn(async (options) => ({
    id: `order_${Date.now()}`,
    entity: 'order',
    amount: Math.round(options.amount * 100),
    amount_paid: 0,
    amount_due: Math.round(options.amount * 100),
    currency: options.currency || 'INR',
    receipt: options.receipt || `receipt_${Date.now()}`,
    status: 'created',
    attempts: 0,
    notes: options.notes || {},
    created_at: Date.now(),
  })),
}));

// Mock connectDB
vi.mock('@/lib/mongoose', () => ({
  default: vi.fn(async () => {}),
}));

describe('ConsolidatedBillPaymentService', () => {
  describe('payConsolidatedBill', () => {
    it('should create a Razorpay order for a pending consolidated bill', async () => {
      const userId = 'user123';
      const paymentCycleId = 'cycle123';
      
      // Create auto payment records
      const record = await AutoPaymentRecord.create({
        userId,
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date(),
        transactionId: 'txn123',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId,
      });

      // Create consolidated bill
      const consolidatedBill = await ConsolidatedBill.create({
        userId,
        paymentCycleId,
        cycleStartDate: new Date('2024-01-01'),
        cycleEndDate: new Date('2024-01-31'),
        totalAmount: 100,
        autoPaymentRecords: [record._id.toString()],
        status: 'pending',
      });

      // Initiate payment
      const result = await payConsolidatedBill(userId, consolidatedBill._id.toString());

      expect(result).toBeDefined();
      expect(result.orderId).toBeDefined();
      expect(result.amount).toBe(100);
      expect(result.currency).toBe('INR');
      expect(result.consolidatedBillId).toBe(consolidatedBill._id.toString());

      // Verify bill was updated with order ID
      const updatedBill = await ConsolidatedBill.findById(consolidatedBill._id);
      expect(updatedBill?.razorpayOrderId).toBe(result.orderId);
    });

    it('should throw error if consolidated bill not found', async () => {
      await expect(
        payConsolidatedBill('user123', new mongoose.Types.ObjectId().toString())
      ).rejects.toThrow('Consolidated bill not found');
    });

    it('should throw error if bill already paid', async () => {
      const userId = 'user123';
      
      const consolidatedBill = await ConsolidatedBill.create({
        userId,
        paymentCycleId: 'cycle123',
        cycleStartDate: new Date('2024-01-01'),
        cycleEndDate: new Date('2024-01-31'),
        totalAmount: 100,
        autoPaymentRecords: ['record1'],
        status: 'paid',
        paidAt: new Date(),
      });

      await expect(
        payConsolidatedBill(userId, consolidatedBill._id.toString())
      ).rejects.toThrow('Consolidated bill is already paid');
    });
  });

  describe('handlePaymentSuccess', () => {
    it('should mark consolidated bill as paid and settle all records', async () => {
      const userId = 'user123';
      const paymentCycleId = 'cycle123';
      const razorpayOrderId = 'order_test123';
      
      // Create auto payment records
      const record1 = await AutoPaymentRecord.create({
        userId,
        billId: 'bill1',
        amount: 50,
        paymentDate: new Date(),
        transactionId: 'txn1',
        billProvider: 'Provider1',
        billType: 'electricity',
        status: 'success',
        paymentCycleId,
      });

      const record2 = await AutoPaymentRecord.create({
        userId,
        billId: 'bill2',
        amount: 50,
        paymentDate: new Date(),
        transactionId: 'txn2',
        billProvider: 'Provider2',
        billType: 'water',
        status: 'success',
        paymentCycleId,
      });

      // Create consolidated bill
      await ConsolidatedBill.create({
        userId,
        paymentCycleId,
        cycleStartDate: new Date('2024-01-01'),
        cycleEndDate: new Date('2024-01-31'),
        totalAmount: 100,
        autoPaymentRecords: [record1._id.toString(), record2._id.toString()],
        status: 'pending',
        razorpayOrderId,
      });

      // Handle payment success
      await handlePaymentSuccess(razorpayOrderId, 'payment_test123');

      // Verify bill is marked as paid
      const updatedBill = await ConsolidatedBill.findOne({ razorpayOrderId });
      expect(updatedBill?.status).toBe('paid');
      expect(updatedBill?.paidAt).toBeDefined();

      // Verify all records are settled
      const updatedRecords = await AutoPaymentRecord.find({
        _id: { $in: [record1._id, record2._id] },
      });
      expect(updatedRecords.every(r => r.status === 'settled')).toBe(true);
    });
  });

  describe('handlePaymentFailure', () => {
    it('should keep consolidated bill as pending to allow retry', async () => {
      const userId = 'user123';
      const razorpayOrderId = 'order_test123';
      
      // Create consolidated bill
      await ConsolidatedBill.create({
        userId,
        paymentCycleId: 'cycle123',
        cycleStartDate: new Date('2024-01-01'),
        cycleEndDate: new Date('2024-01-31'),
        totalAmount: 100,
        autoPaymentRecords: ['record1'],
        status: 'pending',
        razorpayOrderId,
      });

      // Handle payment failure
      await handlePaymentFailure(razorpayOrderId, 'Payment declined');

      // Verify bill is still pending
      const updatedBill = await ConsolidatedBill.findOne({ razorpayOrderId });
      expect(updatedBill?.status).toBe('pending');
      expect(updatedBill?.paidAt).toBeUndefined();
    });
  });
});
