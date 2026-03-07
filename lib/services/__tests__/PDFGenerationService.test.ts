import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PDFGenerationService } from '../PDFGenerationService';
import AutoPaymentRecord from '../../models/AutoPaymentRecord';
import ConsolidatedBill from '../../models/ConsolidatedBill';
import PaymentCycle from '../../models/PaymentCycle';
import { clearDatabase } from '../../test/setup';

describe('PDFGenerationService', () => {
  let pdfService: PDFGenerationService;

  beforeEach(async () => {
    await clearDatabase();
    pdfService = new PDFGenerationService();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('generateConsolidatedBillPDF', () => {
    it('should generate a PDF stream for a valid consolidated bill', async () => {
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

      // Create consolidated bill
      const consolidatedBill = await ConsolidatedBill.create({
        userId: 'user123',
        paymentCycleId: paymentCycle._id.toString(),
        cycleStartDate: paymentCycle.startDate,
        cycleEndDate: paymentCycle.endDate,
        totalAmount: 300,
        autoPaymentRecords: [record1._id.toString(), record2._id.toString()],
        status: 'pending',
      });

      // Generate PDF
      const pdfStream = await pdfService.generateConsolidatedBillPDF(
        consolidatedBill._id.toString()
      );

      // Assertions - Requirement 5.4: Generate PDF with proper formatting
      expect(pdfStream).toBeDefined();
      expect(pdfStream.readable).toBe(true);

      // Read the stream to verify it contains data
      const chunks: Buffer[] = [];
      for await (const chunk of pdfStream) {
        chunks.push(Buffer.from(chunk));
      }
      const pdfBuffer = Buffer.concat(chunks);

      // Verify PDF header (PDF files start with %PDF-)
      expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should throw error when consolidated bill not found', async () => {
      await expect(
        pdfService.generateConsolidatedBillPDF('507f1f77bcf86cd799439011')
      ).rejects.toThrow('Consolidated bill not found');
    });

    it('should generate PDF with multiple itemized bills', async () => {
      // Create a payment cycle
      const paymentCycle = await PaymentCycle.create({
        userId: 'user123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create multiple auto payment records
      const recordIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const record = await AutoPaymentRecord.create({
          userId: 'user123',
          billId: `bill${i}`,
          amount: 100 + i * 50,
          paymentDate: new Date(`2024-01-${10 + i}`),
          transactionId: `txn${i}`,
          billProvider: `Provider ${i}`,
          billType: i % 2 === 0 ? 'electricity' : 'water',
          status: 'success',
          paymentCycleId: paymentCycle._id.toString(),
        });
        recordIds.push(record._id.toString());
      }

      // Create consolidated bill
      const consolidatedBill = await ConsolidatedBill.create({
        userId: 'user123',
        paymentCycleId: paymentCycle._id.toString(),
        cycleStartDate: paymentCycle.startDate,
        cycleEndDate: paymentCycle.endDate,
        totalAmount: 600,
        autoPaymentRecords: recordIds,
        status: 'pending',
      });

      // Generate PDF
      const pdfStream = await pdfService.generateConsolidatedBillPDF(
        consolidatedBill._id.toString()
      );

      // Verify PDF is generated
      expect(pdfStream).toBeDefined();
      expect(pdfStream.readable).toBe(true);

      // Read the stream
      const chunks: Buffer[] = [];
      for await (const chunk of pdfStream) {
        chunks.push(Buffer.from(chunk));
      }
      const pdfBuffer = Buffer.concat(chunks);

      // Verify PDF is valid
      expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
      expect(pdfBuffer.length).toBeGreaterThan(1000); // Should be substantial with 5 items
    });

    it('should generate PDF for paid consolidated bill', async () => {
      // Create a payment cycle
      const paymentCycle = await PaymentCycle.create({
        userId: 'user123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        status: 'active',
      });

      // Create auto payment record
      const record = await AutoPaymentRecord.create({
        userId: 'user123',
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn1',
        billProvider: 'Provider A',
        billType: 'electricity',
        status: 'settled',
        paymentCycleId: paymentCycle._id.toString(),
      });

      // Create paid consolidated bill
      const consolidatedBill = await ConsolidatedBill.create({
        userId: 'user123',
        paymentCycleId: paymentCycle._id.toString(),
        cycleStartDate: paymentCycle.startDate,
        cycleEndDate: paymentCycle.endDate,
        totalAmount: 100,
        autoPaymentRecords: [record._id.toString()],
        status: 'paid',
        paidAt: new Date('2024-02-01'),
        razorpayOrderId: 'order_123',
      });

      // Generate PDF
      const pdfStream = await pdfService.generateConsolidatedBillPDF(
        consolidatedBill._id.toString()
      );

      // Verify PDF is generated
      expect(pdfStream).toBeDefined();
      expect(pdfStream.readable).toBe(true);

      // Read the stream
      const chunks: Buffer[] = [];
      for await (const chunk of pdfStream) {
        chunks.push(Buffer.from(chunk));
      }
      const pdfBuffer = Buffer.concat(chunks);

      // Verify PDF is valid
      expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });
  });
});
