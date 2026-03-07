import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutoPaymentRecordService } from '../AutoPaymentRecordService';
import AutoPaymentRecord from '../../models/AutoPaymentRecord';
import PaymentCycle from '../../models/PaymentCycle';
import { clearDatabase } from '../../test/setup';

describe('AutoPaymentRecordService', () => {
  let service: AutoPaymentRecordService;
  let testUserId: string;
  let testBillId: string;
  let testPaymentCycleId: string;

  beforeEach(async () => {
    await clearDatabase();
    
    service = new AutoPaymentRecordService();
    testUserId = 'user-123';
    testBillId = 'bill-456';

    // Create an active payment cycle for testing
    const cycle = await PaymentCycle.create({
      userId: testUserId,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'active',
    });
    testPaymentCycleId = cycle._id.toString();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('createAutoPaymentRecord', () => {
    it('should create a payment record with all required fields', async () => {
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 100.50,
        transactionId: 'txn-123',
        billProvider: 'Electric Company',
        billType: 'electricity',
      };

      const record = await service.createAutoPaymentRecord(params);

      expect(record).toBeDefined();
      expect(record.userId).toBe(testUserId);
      expect(record.billId).toBe(testBillId);
      expect(record.amount).toBe(100.50);
      expect(record.transactionId).toBe('txn-123');
      expect(record.billProvider).toBe('Electric Company');
      expect(record.billType).toBe('electricity');
      expect(record.status).toBe('success'); // default status
      expect(record.paymentCycleId).toBe(testPaymentCycleId);
      expect(record.paymentDate).toBeInstanceOf(Date);
    });

    it('should create a payment record with custom status', async () => {
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 75.25,
        transactionId: 'txn-456',
        billProvider: 'Water Company',
        billType: 'water',
        status: 'failed' as const,
      };

      const record = await service.createAutoPaymentRecord(params);

      expect(record.status).toBe('failed');
    });

    it('should create a payment record with custom payment date', async () => {
      const customDate = new Date('2024-01-15T10:30:00Z');
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 50.00,
        transactionId: 'txn-789',
        billProvider: 'Gas Company',
        billType: 'gas',
        paymentDate: customDate,
      };

      const record = await service.createAutoPaymentRecord(params);

      expect(record.paymentDate.toISOString()).toBe(customDate.toISOString());
    });

    it('should associate record with active payment cycle', async () => {
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 100.00,
        transactionId: 'txn-cycle-test',
        billProvider: 'Mobile Company',
        billType: 'mobile',
      };

      const record = await service.createAutoPaymentRecord(params);

      expect(record.paymentCycleId).toBe(testPaymentCycleId);

      // Verify the record can be queried by payment cycle
      const cycleRecords = await AutoPaymentRecord.find({
        paymentCycleId: testPaymentCycleId,
      });
      expect(cycleRecords).toHaveLength(1);
      expect(cycleRecords[0].transactionId).toBe('txn-cycle-test');
    });

    it('should link record to original bill', async () => {
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 100.00,
        transactionId: 'txn-bill-link',
        billProvider: 'Internet Company',
        billType: 'internet',
      };

      const record = await service.createAutoPaymentRecord(params);

      expect(record.billId).toBe(testBillId);

      // Verify the record can be queried by bill ID
      const billRecords = await AutoPaymentRecord.find({ billId: testBillId });
      expect(billRecords).toHaveLength(1);
      expect(billRecords[0].transactionId).toBe('txn-bill-link');
    });

    it('should throw error if userId is missing', async () => {
      const params = {
        userId: '',
        billId: testBillId,
        amount: 100.00,
        transactionId: 'txn-no-user',
        billProvider: 'Provider',
        billType: 'type',
      };

      await expect(service.createAutoPaymentRecord(params)).rejects.toThrow(
        'Missing required fields for payment record creation'
      );
    });

    it('should throw error if billId is missing', async () => {
      const params = {
        userId: testUserId,
        billId: '',
        amount: 100.00,
        transactionId: 'txn-no-bill',
        billProvider: 'Provider',
        billType: 'type',
      };

      await expect(service.createAutoPaymentRecord(params)).rejects.toThrow(
        'Missing required fields for payment record creation'
      );
    });

    it('should throw error if transactionId is missing', async () => {
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 100.00,
        transactionId: '',
        billProvider: 'Provider',
        billType: 'type',
      };

      await expect(service.createAutoPaymentRecord(params)).rejects.toThrow(
        'Missing required fields for payment record creation'
      );
    });

    it('should throw error if billProvider is missing', async () => {
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 100.00,
        transactionId: 'txn-123',
        billProvider: '',
        billType: 'type',
      };

      await expect(service.createAutoPaymentRecord(params)).rejects.toThrow(
        'Missing required fields for payment record creation'
      );
    });

    it('should throw error if billType is missing', async () => {
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 100.00,
        transactionId: 'txn-123',
        billProvider: 'Provider',
        billType: '',
      };

      await expect(service.createAutoPaymentRecord(params)).rejects.toThrow(
        'Missing required fields for payment record creation'
      );
    });

    it('should throw error if no active payment cycle exists', async () => {
      // Create a user without an active payment cycle
      const newUserId = 'user-no-cycle';
      
      const params = {
        userId: newUserId,
        billId: testBillId,
        amount: 100.00,
        transactionId: 'txn-no-cycle',
        billProvider: 'Provider',
        billType: 'type',
      };

      await expect(service.createAutoPaymentRecord(params)).rejects.toThrow(
        `No active payment cycle found for user ${newUserId}`
      );
    });

    it('should store bill details correctly', async () => {
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 250.75,
        transactionId: 'txn-details-test',
        billProvider: 'Cable Company',
        billType: 'cable',
      };

      const record = await service.createAutoPaymentRecord(params);

      // Verify all bill details are stored
      expect(record.billProvider).toBe('Cable Company');
      expect(record.billType).toBe('cable');
      expect(record.amount).toBe(250.75);
    });

    it('should store timestamp correctly', async () => {
      const beforeCreate = new Date();
      
      const params = {
        userId: testUserId,
        billId: testBillId,
        amount: 100.00,
        transactionId: 'txn-timestamp',
        billProvider: 'Provider',
        billType: 'type',
      };

      const record = await service.createAutoPaymentRecord(params);
      
      const afterCreate = new Date();

      // Payment date should be between before and after timestamps
      expect(record.paymentDate.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(record.paymentDate.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('should create multiple records for different bills', async () => {
      const params1 = {
        userId: testUserId,
        billId: 'bill-1',
        amount: 100.00,
        transactionId: 'txn-1',
        billProvider: 'Provider 1',
        billType: 'type1',
      };

      const params2 = {
        userId: testUserId,
        billId: 'bill-2',
        amount: 200.00,
        transactionId: 'txn-2',
        billProvider: 'Provider 2',
        billType: 'type2',
      };

      const record1 = await service.createAutoPaymentRecord(params1);
      const record2 = await service.createAutoPaymentRecord(params2);

      expect(record1.billId).toBe('bill-1');
      expect(record2.billId).toBe('bill-2');

      // Both should be in the same payment cycle
      expect(record1.paymentCycleId).toBe(record2.paymentCycleId);
    });

    it('should handle different bill types correctly', async () => {
      const billTypes = ['electricity', 'water', 'gas', 'mobile', 'internet', 'cable'];

      for (let i = 0; i < billTypes.length; i++) {
        const params = {
          userId: testUserId,
          billId: `bill-${i}`,
          amount: 100.00,
          transactionId: `txn-${i}`,
          billProvider: `Provider ${i}`,
          billType: billTypes[i],
        };

        const record = await service.createAutoPaymentRecord(params);
        expect(record.billType).toBe(billTypes[i]);
      }

      const allRecords = await AutoPaymentRecord.find({ userId: testUserId });
      expect(allRecords).toHaveLength(billTypes.length);
    });
  });
});

/**
 * Property-Based Tests for AutoPaymentRecordService
 * Using fast-check for property-based testing
 */
import * as fc from 'fast-check';

describe('Property-Based Tests', () => {
  let service: AutoPaymentRecordService;

  beforeEach(() => {
    service = new AutoPaymentRecordService();
  });

  describe('Property 2: Payment Record Completeness', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
     * 
     * Property: For every successful automatic payment, there exists exactly one 
     * AutoPaymentRecord with all required fields populated.
     * 
     * Required fields:
     * - userId: The user who made the payment
     * - billId: The bill that was paid
     * - amount: The payment amount (positive number)
     * - paymentDate: When the payment was made
     * - transactionId: The BillAPI transaction identifier (Requirement 3.5)
     * - billProvider: The provider name (bill details - Requirement 3.1)
     * - billType: The type of bill (bill details - Requirement 3.1)
     * - status: Payment status
     * - paymentCycleId: The payment cycle this record belongs to (Requirement 3.2)
     * 
     * This property validates that:
     * 1. All required fields are present and non-empty
     * 2. The record is associated with the correct bill (Requirement 3.3)
     * 3. The record is stored in the user's transaction history (Requirement 3.2)
     * 4. The BillAPI transaction identifier is included (Requirement 3.5)
     */
    it('should create exactly one complete record for each successful payment', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate payment data with all required fields
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            amount: fc.double({ min: 0.01, max: 10000, noNaN: true }),
            transactionId: fc.stringMatching(/^txn-[0-9a-f]{16}$/),
            billProvider: fc.constantFrom(
              'Electric Company',
              'Water Company',
              'Gas Company',
              'Internet Provider',
              'Mobile Company',
              'Cable Company'
            ),
            billType: fc.constantFrom(
              'electricity',
              'water',
              'gas',
              'internet',
              'mobile',
              'cable'
            ),
            status: fc.constantFrom('success', 'failed', 'settled'),
          }),
          async (paymentData) => {
            // Cleanup: Remove any existing data for this user before test
            await AutoPaymentRecord.deleteMany({ userId: paymentData.userId });
            await PaymentCycle.deleteMany({ userId: paymentData.userId });

            // Setup: Create active payment cycle for the user
            const cycle = await PaymentCycle.create({
              userId: paymentData.userId,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              status: 'active',
            });

            // Execute: Create payment record
            const record = await service.createAutoPaymentRecord({
              userId: paymentData.userId,
              billId: paymentData.billId,
              amount: paymentData.amount,
              transactionId: paymentData.transactionId,
              billProvider: paymentData.billProvider,
              billType: paymentData.billType,
              status: paymentData.status,
            });

            // Verify: All required fields are populated (Requirement 3.1)
            expect(record.userId).toBe(paymentData.userId);
            expect(record.userId).toBeTruthy();
            
            expect(record.billId).toBe(paymentData.billId);
            expect(record.billId).toBeTruthy();
            
            expect(record.amount).toBe(paymentData.amount);
            expect(record.amount).toBeGreaterThan(0);
            
            expect(record.paymentDate).toBeInstanceOf(Date);
            expect(record.paymentDate).toBeTruthy();
            
            // Requirement 3.5: BillAPI transaction identifier must be included
            expect(record.transactionId).toBe(paymentData.transactionId);
            expect(record.transactionId).toBeTruthy();
            
            // Requirement 3.1: Bill details must be included
            expect(record.billProvider).toBe(paymentData.billProvider);
            expect(record.billProvider).toBeTruthy();
            
            expect(record.billType).toBe(paymentData.billType);
            expect(record.billType).toBeTruthy();
            
            expect(record.status).toBe(paymentData.status);
            expect(record.status).toBeTruthy();
            
            // Requirement 3.2: Record must be stored in payment cycle
            expect(record.paymentCycleId).toBe(cycle._id.toString());
            expect(record.paymentCycleId).toBeTruthy();

            // Verify: Exactly one record exists for this payment (Requirement 3.3)
            const records = await AutoPaymentRecord.find({
              userId: paymentData.userId,
              billId: paymentData.billId,
              transactionId: paymentData.transactionId,
            });
            expect(records).toHaveLength(1);

            // Verify: Record is associated with the correct bill (Requirement 3.3)
            expect(records[0].billId).toBe(paymentData.billId);

            // Verify: Record can be retrieved from transaction history (Requirement 3.2)
            const historyRecords = await AutoPaymentRecord.find({
              userId: paymentData.userId,
            });
            expect(historyRecords.length).toBeGreaterThan(0);
            expect(historyRecords.some(r => r.transactionId === paymentData.transactionId)).toBe(true);

            // Cleanup
            await AutoPaymentRecord.deleteMany({ userId: paymentData.userId });
            await PaymentCycle.deleteMany({ userId: paymentData.userId });
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Multiple payments for different bills should each have their own complete record
     * 
     * This validates that the system correctly handles multiple payments and creates
     * separate, complete records for each one.
     */
    it('should create complete records for multiple payments', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            payments: fc.array(
              fc.record({
                billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
                amount: fc.double({ min: 0.01, max: 5000, noNaN: true }),
                transactionId: fc.stringMatching(/^txn-[0-9a-f]{16}$/),
                billProvider: fc.constantFrom('Electric Company', 'Water Company', 'Gas Company'),
                billType: fc.constantFrom('electricity', 'water', 'gas'),
              }),
              { minLength: 2, maxLength: 5 }
            ),
          }),
          async (testData) => {
            // Cleanup: Remove any existing data for this user before test
            await AutoPaymentRecord.deleteMany({ userId: testData.userId });
            await PaymentCycle.deleteMany({ userId: testData.userId });

            // Setup: Create active payment cycle
            const cycle = await PaymentCycle.create({
              userId: testData.userId,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              status: 'active',
            });

            // Execute: Create multiple payment records
            const createdRecords = [];
            for (const payment of testData.payments) {
              const record = await service.createAutoPaymentRecord({
                userId: testData.userId,
                billId: payment.billId,
                amount: payment.amount,
                transactionId: payment.transactionId,
                billProvider: payment.billProvider,
                billType: payment.billType,
              });
              createdRecords.push(record);
            }

            // Verify: Each payment has exactly one complete record
            expect(createdRecords).toHaveLength(testData.payments.length);

            for (let i = 0; i < testData.payments.length; i++) {
              const payment = testData.payments[i];
              const record = createdRecords[i];

              // All required fields must be populated
              expect(record.userId).toBe(testData.userId);
              expect(record.billId).toBe(payment.billId);
              expect(record.amount).toBe(payment.amount);
              expect(record.transactionId).toBe(payment.transactionId);
              expect(record.billProvider).toBe(payment.billProvider);
              expect(record.billType).toBe(payment.billType);
              expect(record.paymentCycleId).toBe(cycle._id.toString());
              expect(record.paymentDate).toBeInstanceOf(Date);
              expect(record.status).toBeTruthy();

              // Each record should be unique and retrievable
              const foundRecords = await AutoPaymentRecord.find({
                transactionId: payment.transactionId,
              });
              expect(foundRecords).toHaveLength(1);
            }

            // Verify: All records are in the user's transaction history
            const allRecords = await AutoPaymentRecord.find({
              userId: testData.userId,
            });
            expect(allRecords.length).toBeGreaterThanOrEqual(testData.payments.length);

            // Cleanup
            await AutoPaymentRecord.deleteMany({ userId: testData.userId });
            await PaymentCycle.deleteMany({ userId: testData.userId });
          }
        ),
        { numRuns: 30 }
      );
    });

    /**
     * Property: Records must maintain referential integrity with bills and payment cycles
     * 
     * This validates Requirements 3.2 and 3.3 - records must be properly associated
     * with their payment cycles and bills.
     */
    it('should maintain referential integrity between records, bills, and cycles', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            amount: fc.double({ min: 0.01, max: 10000, noNaN: true }),
            transactionId: fc.stringMatching(/^txn-[0-9a-f]{16}$/),
            billProvider: fc.constantFrom('Electric Company', 'Water Company'),
            billType: fc.constantFrom('electricity', 'water'),
          }),
          async (paymentData) => {
            // Cleanup: Remove any existing data for this user before test
            await AutoPaymentRecord.deleteMany({ userId: paymentData.userId });
            await PaymentCycle.deleteMany({ userId: paymentData.userId });

            // Setup: Create active payment cycle
            const cycle = await PaymentCycle.create({
              userId: paymentData.userId,
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
              status: 'active',
            });

            // Execute: Create payment record
            const record = await service.createAutoPaymentRecord({
              userId: paymentData.userId,
              billId: paymentData.billId,
              amount: paymentData.amount,
              transactionId: paymentData.transactionId,
              billProvider: paymentData.billProvider,
              billType: paymentData.billType,
            });

            // Verify: Record is associated with the payment cycle (Requirement 3.2)
            expect(record.paymentCycleId).toBe(cycle._id.toString());
            
            const cycleRecords = await AutoPaymentRecord.find({
              paymentCycleId: cycle._id.toString(),
            });
            expect(cycleRecords.some(r => r.transactionId === paymentData.transactionId)).toBe(true);

            // Verify: Record is associated with the bill (Requirement 3.3)
            expect(record.billId).toBe(paymentData.billId);
            
            const billRecords = await AutoPaymentRecord.find({
              billId: paymentData.billId,
            });
            expect(billRecords.some(r => r.transactionId === paymentData.transactionId)).toBe(true);

            // Verify: Record can be queried by both bill and cycle
            const specificRecord = await AutoPaymentRecord.findOne({
              billId: paymentData.billId,
              paymentCycleId: cycle._id.toString(),
              transactionId: paymentData.transactionId,
            });
            expect(specificRecord).toBeTruthy();
            expect(specificRecord?.userId).toBe(paymentData.userId);

            // Cleanup
            await AutoPaymentRecord.deleteMany({ userId: paymentData.userId });
            await PaymentCycle.deleteMany({ userId: paymentData.userId });
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
