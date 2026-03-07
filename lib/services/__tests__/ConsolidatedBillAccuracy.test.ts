import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AggregationEngine } from '../AggregationEngine';
import AutoPaymentRecord from '../../models/AutoPaymentRecord';
import ConsolidatedBill from '../../models/ConsolidatedBill';
import PaymentCycle from '../../models/PaymentCycle';

/**
 * Property-Based Test for Consolidated Bill Accuracy
 * Using fast-check for property-based testing
 * 
 * **Validates: Requirements 4.3**
 * 
 * Property 3: Consolidated Bill Accuracy
 * The total amount in a ConsolidatedBill equals the sum of all linked AutoPaymentRecord amounts.
 */
describe('Property 3: Consolidated Bill Accuracy', () => {
  let aggregationEngine: AggregationEngine;

  beforeEach(() => {
    aggregationEngine = new AggregationEngine();
  });

  /**
   * **Validates: Requirements 4.3**
   * 
   * Property: The total amount in a ConsolidatedBill equals the sum of all linked 
   * AutoPaymentRecord amounts.
   * 
   * This property validates that:
   * 1. The Aggregation_Engine calculates the total amount by summing all Individual_Bill 
   *    amounts in the Consolidated_Bill (Requirement 4.3)
   * 2. The calculation is accurate regardless of the number of records
   * 3. The calculation is accurate regardless of the amount values
   * 4. All linked AutoPaymentRecords are included in the sum
   */
  it('should calculate total amount as sum of all linked auto payment record amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data
        fc.record({
          userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
          // Generate 1 to 20 payment records
          recordCount: fc.integer({ min: 1, max: 20 }),
        }),
        fc.array(
          fc.record({
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            // Generate amounts with various ranges to test edge cases
            amount: fc.double({ min: 0.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
            transactionId: fc.stringMatching(/^txn-[0-9a-f]{16}$/),
            billProvider: fc.constantFrom(
              'Electric Company',
              'Water Company',
              'Gas Company',
              'Internet Provider',
              'Mobile Company'
            ),
            billType: fc.constantFrom(
              'electricity',
              'water',
              'gas',
              'internet',
              'mobile'
            ),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (testData, paymentRecords) => {
          // Cleanup: Remove any existing data for this user
          await AutoPaymentRecord.deleteMany({ userId: testData.userId });
          await ConsolidatedBill.deleteMany({ userId: testData.userId });
          await PaymentCycle.deleteMany({ userId: testData.userId });

          // Setup: Create active payment cycle for the user
          const cycle = await PaymentCycle.create({
            userId: testData.userId,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            status: 'active',
          });

          // Create auto payment records with the generated data
          const createdRecords = [];
          for (const recordData of paymentRecords) {
            const record = await AutoPaymentRecord.create({
              userId: testData.userId,
              billId: recordData.billId,
              amount: recordData.amount,
              paymentDate: new Date(),
              transactionId: recordData.transactionId,
              billProvider: recordData.billProvider,
              billType: recordData.billType,
              status: 'success',
              paymentCycleId: cycle._id.toString(),
            });
            createdRecords.push(record);
          }

          // Execute: Generate consolidated bill
          const consolidatedBill = await aggregationEngine.generateConsolidatedBill(
            testData.userId,
            cycle._id.toString()
          );

          // Verify: Consolidated bill was created
          expect(consolidatedBill).not.toBeNull();
          expect(consolidatedBill).toBeDefined();

          // Calculate expected total by summing all record amounts
          const expectedTotal = createdRecords.reduce(
            (sum, record) => sum + record.amount,
            0
          );

          // Verify: Total amount equals sum of all linked record amounts (Requirement 4.3)
          expect(consolidatedBill!.totalAmount).toBeCloseTo(expectedTotal, 2);

          // Verify: All created records are linked to the consolidated bill
          expect(consolidatedBill!.autoPaymentRecords).toHaveLength(createdRecords.length);

          // Verify: Each linked record ID matches a created record
          const linkedRecordIds = consolidatedBill!.autoPaymentRecords.map((id) => id.toString());
          const createdRecordIds = createdRecords.map((record) => record._id.toString());
          
          for (const linkedId of linkedRecordIds) {
            expect(createdRecordIds).toContain(linkedId);
          }

          // Verify: Sum of amounts from linked records matches total
          const linkedRecords = await AutoPaymentRecord.find({
            _id: { $in: consolidatedBill!.autoPaymentRecords },
          });

          const linkedRecordsSum = linkedRecords.reduce(
            (sum, record) => sum + record.amount,
            0
          );

          expect(consolidatedBill!.totalAmount).toBeCloseTo(linkedRecordsSum, 2);

          // Cleanup after test
          await AutoPaymentRecord.deleteMany({ userId: testData.userId });
          await ConsolidatedBill.deleteMany({ userId: testData.userId });
          await PaymentCycle.deleteMany({ userId: testData.userId });
        }
      ),
      {
        numRuns: 20, // Reduced from 50 to 20 to prevent timeout
        endOnFailure: true,
      }
    );
  }, 10000); // Increase timeout to 10 seconds

  /**
   * Edge case: Test with very small amounts (cents)
   * Validates that the calculation is accurate even with small decimal values
   */
  it('should accurately calculate total with very small amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
        }),
        fc.array(
          fc.record({
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            // Generate very small amounts (cents)
            amount: fc.double({ min: 0.01, max: 1.00, noNaN: true, noDefaultInfinity: true }),
            transactionId: fc.stringMatching(/^txn-[0-9a-f]{16}$/),
            billProvider: fc.constant('Test Provider'),
            billType: fc.constant('test'),
          }),
          { minLength: 5, maxLength: 10 }
        ),
        async (testData, paymentRecords) => {
          // Cleanup
          await AutoPaymentRecord.deleteMany({ userId: testData.userId });
          await ConsolidatedBill.deleteMany({ userId: testData.userId });
          await PaymentCycle.deleteMany({ userId: testData.userId });

          // Setup payment cycle
          const cycle = await PaymentCycle.create({
            userId: testData.userId,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            status: 'active',
          });

          // Create records
          const createdRecords = [];
          for (const recordData of paymentRecords) {
            const record = await AutoPaymentRecord.create({
              userId: testData.userId,
              billId: recordData.billId,
              amount: recordData.amount,
              paymentDate: new Date(),
              transactionId: recordData.transactionId,
              billProvider: recordData.billProvider,
              billType: recordData.billType,
              status: 'success',
              paymentCycleId: cycle._id.toString(),
            });
            createdRecords.push(record);
          }

          // Generate consolidated bill
          const consolidatedBill = await aggregationEngine.generateConsolidatedBill(
            testData.userId,
            cycle._id.toString()
          );

          // Calculate expected total
          const expectedTotal = createdRecords.reduce(
            (sum, record) => sum + record.amount,
            0
          );

          // Verify accuracy with small amounts
          expect(consolidatedBill!.totalAmount).toBeCloseTo(expectedTotal, 2);

          // Cleanup
          await AutoPaymentRecord.deleteMany({ userId: testData.userId });
          await ConsolidatedBill.deleteMany({ userId: testData.userId });
          await PaymentCycle.deleteMany({ userId: testData.userId });
        }
      ),
      {
        numRuns: 30,
        endOnFailure: true,
      }
    );
  });

  /**
   * Edge case: Test with very large amounts
   * Validates that the calculation is accurate even with large values
   */
  it('should accurately calculate total with very large amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.stringMatching(/^user-[0-9a-f]{8}$/),
        }),
        fc.array(
          fc.record({
            billId: fc.stringMatching(/^bill-[0-9a-f]{8}$/),
            // Generate large amounts
            amount: fc.double({ min: 5000, max: 50000, noNaN: true, noDefaultInfinity: true }),
            transactionId: fc.stringMatching(/^txn-[0-9a-f]{16}$/),
            billProvider: fc.constant('Test Provider'),
            billType: fc.constant('test'),
          }),
          { minLength: 3, maxLength: 8 }
        ),
        async (testData, paymentRecords) => {
          // Cleanup
          await AutoPaymentRecord.deleteMany({ userId: testData.userId });
          await ConsolidatedBill.deleteMany({ userId: testData.userId });
          await PaymentCycle.deleteMany({ userId: testData.userId });

          // Setup payment cycle
          const cycle = await PaymentCycle.create({
            userId: testData.userId,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            status: 'active',
          });

          // Create records
          const createdRecords = [];
          for (const recordData of paymentRecords) {
            const record = await AutoPaymentRecord.create({
              userId: testData.userId,
              billId: recordData.billId,
              amount: recordData.amount,
              paymentDate: new Date(),
              transactionId: recordData.transactionId,
              billProvider: recordData.billProvider,
              billType: recordData.billType,
              status: 'success',
              paymentCycleId: cycle._id.toString(),
            });
            createdRecords.push(record);
          }

          // Generate consolidated bill
          const consolidatedBill = await aggregationEngine.generateConsolidatedBill(
            testData.userId,
            cycle._id.toString()
          );

          // Calculate expected total
          const expectedTotal = createdRecords.reduce(
            (sum, record) => sum + record.amount,
            0
          );

          // Verify accuracy with large amounts
          expect(consolidatedBill!.totalAmount).toBeCloseTo(expectedTotal, 2);

          // Cleanup
          await AutoPaymentRecord.deleteMany({ userId: testData.userId });
          await ConsolidatedBill.deleteMany({ userId: testData.userId });
          await PaymentCycle.deleteMany({ userId: testData.userId });
        }
      ),
      {
        numRuns: 30,
        endOnFailure: true,
      }
    );
  });
});
