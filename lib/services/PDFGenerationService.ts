import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import ConsolidatedBill, { IConsolidatedBill } from '../models/ConsolidatedBill';
import AutoPaymentRecord, { IAutoPaymentRecord } from '../models/AutoPaymentRecord';
import logger from '../logger';

/**
 * PDFGenerationService
 * Generates PDF documents for consolidated bills
 * Validates: Requirement 5.4
 */
export class PDFGenerationService {
  // Color palette
  private readonly colors = {
    primary: rgb(0.2, 0.4, 0.8), // Blue
    secondary: rgb(0.3, 0.3, 0.3), // Dark gray
    accent: rgb(0.95, 0.95, 0.95), // Light gray
    success: rgb(0.13, 0.55, 0.13), // Green
    text: rgb(0.2, 0.2, 0.2), // Dark text
    lightText: rgb(0.5, 0.5, 0.5), // Light text
    border: rgb(0.85, 0.85, 0.85), // Border gray
  };

  /**
   * Generate a PDF for a consolidated bill
   * @param consolidatedBillId - The ID of the consolidated bill
   * @returns A buffer containing the PDF data
   */
  async generateConsolidatedBillPDF(consolidatedBillId: string): Promise<Buffer> {
    try {
      // Fetch the consolidated bill
      const consolidatedBill = await ConsolidatedBill.findById(consolidatedBillId);
      if (!consolidatedBill) {
        throw new Error('Consolidated bill not found');
      }

      // Fetch all associated auto payment records
      const autoPaymentRecords = await AutoPaymentRecord.find({
        _id: { $in: consolidatedBill.autoPaymentRecords },
      }).sort({ paymentDate: 1 });

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 size
      const { width, height } = page.getSize();

      // Load fonts
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      let yPosition = height - 40;

      // Header section with background
      page.drawRectangle({
        x: 0,
        y: height - 120,
        width: width,
        height: 120,
        color: this.colors.primary,
      });

      // Company name
      page.drawText('BillSync', {
        x: 50,
        y: height - 60,
        size: 32,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      // Tagline
      page.drawText('Automated Bill Payment System', {
        x: 50,
        y: height - 85,
        size: 11,
        font: regularFont,
        color: rgb(0.9, 0.9, 0.9),
      });

      // Document title
      page.drawText('CONSOLIDATED BILL', {
        x: width - 250,
        y: height - 60,
        size: 16,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      // Bill ID
      page.drawText(`#${consolidatedBill._id.toString().substring(0, 12).toUpperCase()}`, {
        x: width - 250,
        y: height - 85,
        size: 10,
        font: regularFont,
        color: rgb(0.9, 0.9, 0.9),
      });

      yPosition = height - 150;

      // Bill Information Section
      this.drawSectionHeader(page, 'Bill Information', 50, yPosition, boldFont);
      yPosition -= 30;

      // Info box with light background
      const infoBoxHeight = 100;
      page.drawRectangle({
        x: 50,
        y: yPosition - infoBoxHeight,
        width: width - 100,
        height: infoBoxHeight,
        color: this.colors.accent,
        borderColor: this.colors.border,
        borderWidth: 1,
      });

      // Two-column layout for bill info
      const leftCol = 60;
      const rightCol = 320;
      let infoY = yPosition - 25;

      // Left column
      this.drawInfoRow(page, 'Billing Period:', 
        `${this.formatDate(consolidatedBill.cycleStartDate)} - ${this.formatDate(consolidatedBill.cycleEndDate)}`,
        leftCol, infoY, regularFont, boldFont);
      infoY -= 20;

      this.drawInfoRow(page, 'Generated Date:', 
        this.formatDate(consolidatedBill.createdAt),
        leftCol, infoY, regularFont, boldFont);
      infoY -= 20;

      // Right column
      infoY = yPosition - 25;
      this.drawInfoRow(page, 'Status:', 
        consolidatedBill.status.toUpperCase(),
        rightCol, infoY, regularFont, boldFont,
        consolidatedBill.status === 'paid' ? this.colors.success : this.colors.primary);
      infoY -= 20;

      if (consolidatedBill.paidAt) {
        this.drawInfoRow(page, 'Payment Date:', 
          this.formatDate(consolidatedBill.paidAt),
          rightCol, infoY, regularFont, boldFont);
      }

      yPosition -= infoBoxHeight + 40;

      // Itemized Bills Section
      this.drawSectionHeader(page, 'Payment Details', 50, yPosition, boldFont);
      yPosition -= 30;

      // Table header with background
      const tableHeaderY = yPosition;
      page.drawRectangle({
        x: 50,
        y: tableHeaderY - 20,
        width: width - 100,
        height: 25,
        color: this.colors.secondary,
      });

      const headers = ['Date', 'Provider', 'Type', 'Transaction ID', 'Amount'];
      const columnX = [60, 140, 260, 340, 450];
      const columnWidths = [70, 110, 70, 100, 45];

      headers.forEach((header, i) => {
        page.drawText(header, {
          x: columnX[i],
          y: tableHeaderY - 13,
          size: 9,
          font: boldFont,
          color: rgb(1, 1, 1),
        });
      });

      yPosition = tableHeaderY - 35;

      // Table rows with alternating background
      autoPaymentRecords.forEach((record, index) => {
        // Check if we need a new page
        if (yPosition < 150) {
          const newPage = pdfDoc.addPage([595, 842]);
          yPosition = height - 50;
        }

        // Alternating row background
        if (index % 2 === 0) {
          page.drawRectangle({
            x: 50,
            y: yPosition - 5,
            width: width - 100,
            height: 20,
            color: rgb(0.98, 0.98, 0.98),
          });
        }

        const rowData = [
          this.formatDate(record.paymentDate),
          this.truncate(record.billProvider, 14),
          this.capitalizeFirst(record.billType),
          this.truncate(record.transactionId, 12),
          `Rs. ${record.amount.toFixed(2)}`,
        ];

        rowData.forEach((data, i) => {
          page.drawText(data, {
            x: columnX[i],
            y: yPosition,
            size: 8,
            font: regularFont,
            color: this.colors.text,
          });
        });

        yPosition -= 20;
      });

      // Bottom border of table
      page.drawLine({
        start: { x: 50, y: yPosition + 15 },
        end: { x: width - 50, y: yPosition + 15 },
        thickness: 1,
        color: this.colors.border,
      });

      yPosition -= 30;

      // Summary section
      const summaryBoxY = yPosition;
      const summaryBoxHeight = 60;
      
      page.drawRectangle({
        x: width - 250,
        y: summaryBoxY - summaryBoxHeight,
        width: 200,
        height: summaryBoxHeight,
        color: this.colors.accent,
        borderColor: this.colors.border,
        borderWidth: 1,
      });

      // Subtotal
      page.drawText('Subtotal:', {
        x: width - 235,
        y: summaryBoxY - 25,
        size: 10,
        font: regularFont,
        color: this.colors.text,
      });

      page.drawText(`Rs. ${consolidatedBill.totalAmount.toFixed(2)}`, {
        x: width - 120,
        y: summaryBoxY - 25,
        size: 10,
        font: regularFont,
        color: this.colors.text,
      });

      // Total (with emphasis)
      page.drawLine({
        start: { x: width - 235, y: summaryBoxY - 35 },
        end: { x: width - 65, y: summaryBoxY - 35 },
        thickness: 1,
        color: this.colors.border,
      });

      page.drawText('Total Amount:', {
        x: width - 235,
        y: summaryBoxY - 50,
        size: 12,
        font: boldFont,
        color: this.colors.primary,
      });

      page.drawText(`Rs. ${consolidatedBill.totalAmount.toFixed(2)}`, {
        x: width - 120,
        y: summaryBoxY - 50,
        size: 12,
        font: boldFont,
        color: this.colors.primary,
      });

      // Footer
      const footerY = 60;
      
      // Footer separator line
      page.drawLine({
        start: { x: 50, y: footerY + 20 },
        end: { x: width - 50, y: footerY + 20 },
        thickness: 0.5,
        color: this.colors.border,
      });

      page.drawText('This is a system-generated document. All payments were automatically processed.', {
        x: 50,
        y: footerY,
        size: 8,
        font: regularFont,
        color: this.colors.lightText,
      });

      page.drawText('For questions or support, contact: support@billsync.com', {
        x: 50,
        y: footerY - 15,
        size: 8,
        font: regularFont,
        color: this.colors.lightText,
      });

      // Page number
      page.drawText('Page 1', {
        x: width - 80,
        y: footerY - 15,
        size: 8,
        font: regularFont,
        color: this.colors.lightText,
      });

      // Generate PDF bytes
      const pdfBytes = await pdfDoc.save();

      logger.info(`PDF generated for consolidated bill ${consolidatedBillId}`);

      return Buffer.from(pdfBytes);
    } catch (error) {
      logger.error({ error }, 'Error generating PDF');
      throw error;
    }
  }

  /**
   * Draw a section header
   */
  private drawSectionHeader(
    page: any,
    text: string,
    x: number,
    y: number,
    font: any
  ): void {
    page.drawText(text, {
      x,
      y,
      size: 14,
      font,
      color: this.colors.secondary,
    });

    // Underline
    page.drawLine({
      start: { x, y: y - 5 },
      end: { x: x + 150, y: y - 5 },
      thickness: 2,
      color: this.colors.primary,
    });
  }

  /**
   * Draw an info row with label and value
   */
  private drawInfoRow(
    page: any,
    label: string,
    value: string,
    x: number,
    y: number,
    regularFont: any,
    boldFont: any,
    valueColor = this.colors.text
  ): void {
    page.drawText(label, {
      x,
      y,
      size: 9,
      font: regularFont,
      color: this.colors.lightText,
    });

    page.drawText(value, {
      x: x + 100,
      y,
      size: 9,
      font: boldFont,
      color: valueColor,
    });
  }

  /**
   * Format date to readable string
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Truncate string to specified length
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export default new PDFGenerationService();
