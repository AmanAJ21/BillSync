import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import PaymentCycle, { PaymentCycleStatus } from '../PaymentCycle';
import AutoPaymentRecord, { AutoPaymentRecordStatus } from '../AutoPaymentRecord';

/**
 * Property 4: Payment Cycle Integrity
 * **Validates: Requirements 7.3, 7.4**
 * 
 * Statement: At any given time, each user has exactly one active PaymentCycle,
 * and all AutoPaymentRecords belong to exactly one PaymentCycle.
 */
describe('Property 4: Payment Cycle Integrity', () => {
  
  /**
   * Property Test: Each user can have at most one active payment cycle
   * 
   * This test verifies that the system enforces the constraint that a user
   * cannot have multiple active payment cycles simultaneously.
   */
  it('should enforce that each user has at most one active payment cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary user IDs (non-empty, non-whitespace)
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        // Generate arbitrary date ranges for payment cycles
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 1, max: 90 }), // days duration
        async (userIdRaw, startDate, durationDays) => {
          // Trim userId to match model behavior (model has trim: true)
          const userId = userIdRaw.trim();
          
          // Arrange: Create first active payment cycle
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + durationDays);
          
          const firstCycle = await PaymentCycle.create({
            userId,
            startDate,
            endDate,
            status: PaymentCycleStatus.ACTIVE,
          });
          
          // Act: Attempt to create a second active payment cycle for the same user
          const secondStartDate = new Date(endDate);
          secondStartDate.setDate(secondStartDate.getDate() + 1);
          const secondEndDate = new Date(secondStartDate);
          secondEndDate.setDate(secondEndDate.getDate() + durationDays);
          
          let errorThrown = false;
          try {
            await PaymentCycle.create({
              userId,
              startDate: secondStartDate,
              endDate: secondEndDate,
              status: PaymentCycleStatus.ACTIVE,
            });
          } catch (error) {
            errorThrown = true;
          }
          
          // Assert: Second active cycle creation should fail
          expect(errorThrown).toBe(true);
          
          // Verify only one active cycle exists
          const activeCycles = await PaymentCycle.find({
            userId,
            status: PaymentCycleStatus.ACTIVE,
          });
          expect(activeCycles).toHaveLength(1);
          expect(activeCycles[0]._id.toString()).toBe(firstCycle._id.toString());
        }
      ),
      { numRuns: 50 } // Run 50 test cases
    );
  });

  /**
   * Property Test: Users can have multiple completed payment cycles
   * 
   * This test verifies that users can have multiple payment cycles as long as
   * only one is active at a time.
   */
  it('should allow multiple completed payment cycles for the same user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 2, max: 5 }), // number of completed cycles
        async (userIdRaw, numCycles) => {
          // Trim userId to match model behavior
          const userId = userIdRaw.trim();
          
          // Ensure clean state for this user
          await PaymentCycle.deleteMany({ userId });
          
          // Arrange & Act: Create multiple completed payment cycles
          const cycles = [];
          let currentDate = new Date('2024-01-01');
          
          for (let i = 0; i < numCycles; i++) {
            const startDate = new Date(currentDate);
            const endDate = new Date(currentDate);
            endDate.setMonth(endDate.getMonth() + 1);
            
            const cycle = await PaymentCycle.create({
              userId,
              startDate,
              endDate,
              status: PaymentCycleStatus.COMPLETED,
            });
            cycles.push(cycle);
            
            currentDate = new Date(endDate);
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // Assert: All cycles should be created successfully
          const allCycles = await PaymentCycle.find({ userId });
          expect(allCycles).toHaveLength(numCycles);
          
          // Verify all are completed
          const completedCycles = await PaymentCycle.find({
            userId,
            status: PaymentCycleStatus.COMPLETED,
          });
          expect(completedCycles).toHaveLength(numCycles);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property Test: All AutoPaymentRecords belong to exactly one PaymentCycle
   * 
   * This test verifies that every AutoPaymentRecord is associated with a valid
   * PaymentCycle and that the association is unique.
   */
  it('should ensure all AutoPaymentRecords belong to exactly one PaymentCycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), // userId
        fc.integer({ min: 1, max: 10 }), // number of payment records
        async (userIdRaw, numRecords) => {
          // Trim userId to match model behavior
          const userId = userIdRaw.trim();
          
          // Ensure clean state for this user
          await PaymentCycle.deleteMany({ userId });
          await AutoPaymentRecord.deleteMany({ userId });
          
          // Arrange: Create a payment cycle
          const startDate = new Date('2024-01-01');
          const endDate = new Date('2024-01-31');
          
          const paymentCycle = await PaymentCycle.create({
            userId,
            startDate,
            endDate,
            status: PaymentCycleStatus.ACTIVE,
          });
          
          // Act: Create multiple payment records for this cycle
          const records = [];
          for (let i = 0; i < numRecords; i++) {
            const record = await AutoPaymentRecord.create({
              userId,
              billId: `bill-${i}`,
              amount: Math.random() * 1000 + 10,
              paymentDate: new Date(startDate.getTime() + i * 86400000), // Spread across cycle
              transactionId: `txn-${userId}-${i}-${Date.now()}-${Math.random()}`,
              billProvider: `Provider ${i}`,
              billType: 'electricity',
              status: AutoPaymentRecordStatus.SUCCESS,
              paymentCycleId: paymentCycle._id.toString(),
            });
            records.push(record);
          }
          
          // Assert: All records should belong to the payment cycle
          for (const record of records) {
            expect(record.paymentCycleId).toBe(paymentCycle._id.toString());
            
            // Verify the payment cycle exists
            const cycle = await PaymentCycle.findById(record.paymentCycleId);
            expect(cycle).not.toBeNull();
            expect(cycle?.userId).toBe(userId);
          }
          
          // Verify all records can be retrieved by payment cycle
          const cycleRecords = await AutoPaymentRecord.find({
            paymentCycleId: paymentCycle._id.toString(),
          });
          expect(cycleRecords).toHaveLength(numRecords);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property Test: Payment records cannot exist without a valid payment cycle
   * 
   * This test verifies referential integrity - payment records must reference
   * an existing payment cycle.
   */
  it('should maintain referential integrity between payment records and cycles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 1, max: 5 }),
        async (userIdRaw, numRecords) => {
          // Trim userId to match model behavior
          const userId = userIdRaw.trim();
          
          // Ensure clean state for this user
          await PaymentCycle.deleteMany({ userId });
          await AutoPaymentRecord.deleteMany({ userId });
          
          // Arrange: Create a payment cycle
          const paymentCycle = await PaymentCycle.create({
            userId,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            status: PaymentCycleStatus.ACTIVE,
          });
          
          // Act: Create payment records
          const records = [];
          for (let i = 0; i < numRecords; i++) {
            const record = await AutoPaymentRecord.create({
              userId,
              billId: `bill-${i}`,
              amount: 100 + i * 10,
              paymentDate: new Date('2024-01-15'),
              transactionId: `txn-${userId}-${i}-${Date.now()}`,
              billProvider: 'Provider',
              billType: 'electricity',
              status: AutoPaymentRecordStatus.SUCCESS,
              paymentCycleId: paymentCycle._id.toString(),
            });
            records.push(record);
          }
          
          // Assert: All records reference the valid cycle
          for (const record of records) {
            const referencedCycle = await PaymentCycle.findById(record.paymentCycleId);
            expect(referencedCycle).not.toBeNull();
            expect(referencedCycle?._id.toString()).toBe(paymentCycle._id.toString());
          }
          
          // Verify orphaned records don't exist
          const allRecords = await AutoPaymentRecord.find({ userId });
          for (const record of allRecords) {
            const cycle = await PaymentCycle.findById(record.paymentCycleId);
            expect(cycle).not.toBeNull();
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property Test: Completing a cycle doesn't affect record associations
   * 
   * This test verifies that when a payment cycle is completed, all associated
   * payment records maintain their relationship with the cycle.
   */
  it('should maintain record associations when cycle status changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 1, max: 5 }),
        async (userIdRaw, numRecords) => {
          // Trim userId to match model behavior
          const userId = userIdRaw.trim();
          
          // Arrange: Create active cycle with records
          const paymentCycle = await PaymentCycle.create({
            userId,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            status: PaymentCycleStatus.ACTIVE,
          });
          
          const recordIds = [];
          for (let i = 0; i < numRecords; i++) {
            const record = await AutoPaymentRecord.create({
              userId,
              billId: `bill-${i}`,
              amount: 100,
              paymentDate: new Date('2024-01-15'),
              transactionId: `txn-${userId}-${i}-${Date.now()}`,
              billProvider: 'Provider',
              billType: 'electricity',
              status: AutoPaymentRecordStatus.SUCCESS,
              paymentCycleId: paymentCycle._id.toString(),
            });
            recordIds.push(record._id.toString());
          }
          
          // Act: Complete the payment cycle
          paymentCycle.status = PaymentCycleStatus.COMPLETED;
          await paymentCycle.save();
          
          // Assert: All records still reference the same cycle
          const recordsAfterCompletion = await AutoPaymentRecord.find({
            _id: { $in: recordIds },
          });
          
          expect(recordsAfterCompletion).toHaveLength(numRecords);
          for (const record of recordsAfterCompletion) {
            expect(record.paymentCycleId).toBe(paymentCycle._id.toString());
          }
          
          // Verify cycle is completed
          const completedCycle = await PaymentCycle.findById(paymentCycle._id);
          expect(completedCycle?.status).toBe(PaymentCycleStatus.COMPLETED);
        }
      ),
      { numRuns: 30 }
    );
  });
});
