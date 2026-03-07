import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import ConsolidatedBill from '@/lib/models/ConsolidatedBill';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';
import { handlePaymentSuccess } from '@/lib/services/ConsolidatedBillPaymentService';

/**
 * Property 6: Settlement Consistency
 * **Validates: Requirements 6.5**
 * 
 * Property: When a ConsolidatedBill is marked as paid, all linked AutoPaymentRecords are marked as settled
 */

// Mock Razorpay service to avoid initialization issues
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
  verifyRazorpaySignature: vi.fn(() => true),
  verifyWebhookSignature: vi.fn(() => true),
  fetchPaymentDetails: vi.fn(async (paymentId) => ({
    id: paymentId,
    status: 'captured',
  })),
}));

// Mock connectDB to prevent it from connecting to a different database
vi.mock('@/lib/mongoose', () => ({
  default: vi.fn(async () => {}),
}));

describe('Property 6: Settlement Consistency', () => {
  it('should mark all linked AutoPaymentRecords as settled when ConsolidatedBill is paid', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data with non-empty strings and unique identifiers
        fc.record({
          userId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          paymentCycleId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          recordCount: fc.integer({ min: 1, max: 10 }),
          totalAmount: fc.float({ min: 100, max: 10000, noNaN: true }),
        }),
        async (testData) => {
          // Add unique suffix to avoid duplicate key errors
          const uniqueSuffix = `_${Date.now()}_${Math.random()}`;
          const userId = testData.userId + uniqueSuffix;
          const paymentCycleId = testData.paymentCycleId + uniqueSuffix;
          
          // Create auto payment records
          const autoPaymentRecords = [];
          
          for (let i = 0; i < testData.recordCount; i++) {
            const record = await AutoPaymentRecord.create({
              userId,
              billId: `bill_${i}_${uniqueSuffix}`,
              amount: testData.totalAmount / testData.recordCount,
              paymentDate: new Date(),
              transactionId: `txn_${Date.now()}_${i}_${Math.random()}`,
              billProvider: `Provider ${i}`,
              billType: 'electricity',
              status: 'success',
              paymentCycleId,
            });
            autoPaymentRecords.push(record._id.toString());
          }

          // Create consolidated bill
          const razorpayOrderId = `order_${uniqueSuffix}`;
          const consolidatedBill = await ConsolidatedBill.create({
            userId,
            paymentCycleId,
            cycleStartDate: new Date('2024-01-01'),
            cycleEndDate: new Date('2024-01-31'),
            totalAmount: testData.totalAmount,
            autoPaymentRecords,
            status: 'pending',
            razorpayOrderId,
          });

          // Verify initial state - all records should be 'success'
          const recordsBeforePayment = await AutoPaymentRecord.find({
            _id: { $in: autoPaymentRecords },
          });
          
          const allInitiallySuccess = recordsBeforePayment.every(
            (record) => record.status === 'success'
          );
          expect(allInitiallySuccess).toBe(true);

          // Handle payment success
          await handlePaymentSuccess(razorpayOrderId, `payment_${Date.now()}`);

          // Verify consolidated bill is marked as paid
          const updatedBill = await ConsolidatedBill.findById(consolidatedBill._id);
          expect(updatedBill?.status).toBe('paid');
          expect(updatedBill?.paidAt).toBeDefined();

          // Verify all linked auto payment records are marked as settled
          const recordsAfterPayment = await AutoPaymentRecord.find({
            _id: { $in: autoPaymentRecords },
          });

          // Property: All linked records must be settled
          const allSettled = recordsAfterPayment.every(
            (record) => record.status === 'settled'
          );
          
          expect(allSettled).toBe(true);
          expect(recordsAfterPayment.length).toBe(testData.recordCount);

          // Cleanup
          await ConsolidatedBill.deleteOne({ _id: consolidatedBill._id });
          await AutoPaymentRecord.deleteMany({ _id: { $in: autoPaymentRecords } });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain settlement consistency even with mixed initial statuses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          paymentCycleId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
          recordCount: fc.integer({ min: 2, max: 8 }),
        }),
        async (testData) => {
          // Add unique suffix to avoid duplicate key errors
          const uniqueSuffix = `_${Date.now()}_${Math.random()}`;
          const userId = testData.userId + uniqueSuffix;
          const paymentCycleId = testData.paymentCycleId + uniqueSuffix;
          
          // Create auto payment records with mixed statuses
          const autoPaymentRecords = [];
          const statuses: Array<'success' | 'failed'> = ['success', 'failed'];
          
          for (let i = 0; i < testData.recordCount; i++) {
            const record = await AutoPaymentRecord.create({
              userId,
              billId: `bill_${i}_${uniqueSuffix}`,
              amount: 100,
              paymentDate: new Date(),
              transactionId: `txn_${Date.now()}_${i}_${Math.random()}`,
              billProvider: `Provider ${i}`,
              billType: 'electricity',
              status: statuses[i % 2],
              paymentCycleId,
            });
            autoPaymentRecords.push(record._id.toString());
          }

          // Create consolidated bill
          const razorpayOrderId = `order_${uniqueSuffix}`;
          const consolidatedBill = await ConsolidatedBill.create({
            userId,
            paymentCycleId,
            cycleStartDate: new Date('2024-01-01'),
            cycleEndDate: new Date('2024-01-31'),
            totalAmount: testData.recordCount * 100,
            autoPaymentRecords,
            status: 'pending',
            razorpayOrderId,
          });

          // Handle payment success
          await handlePaymentSuccess(razorpayOrderId, `payment_${Date.now()}`);

          // Verify all records are settled regardless of initial status
          const recordsAfterPayment = await AutoPaymentRecord.find({
            _id: { $in: autoPaymentRecords },
          });

          const allSettled = recordsAfterPayment.every(
            (record) => record.status === 'settled'
          );
          
          expect(allSettled).toBe(true);

          // Cleanup
          await ConsolidatedBill.deleteOne({ _id: consolidatedBill._id });
          await AutoPaymentRecord.deleteMany({ _id: { $in: autoPaymentRecords } });
        }
      ),
      { numRuns: 15 }
    );
  });
});
