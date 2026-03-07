import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import ConsolidatedBill from '@/lib/models/ConsolidatedBill';
import { PDFGenerationService } from '@/lib/services/PDFGenerationService';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

const pdfService = new PDFGenerationService();

/**
 * GET /api/consolidated-bills/[id]/pdf
 * Download consolidated bill as PDF
 * Validates: Requirement 5.4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    // Authenticate user
    const auth = authenticateRequest(request);
    if (auth.error) {
      logger.error('Authentication failed');
      return auth.error;
    }

    // Await params to get the id
    const { id } = await params;
    logger.info(`Processing PDF request for bill ${id}, user ${auth.userId}`);

    // Find the consolidated bill to verify ownership
    const consolidatedBill = await ConsolidatedBill.findById(id).lean();
    logger.info(`Bill lookup result: ${consolidatedBill ? 'found' : 'not found'}`);

    if (!consolidatedBill) {
      return NextResponse.json(
        { error: 'Consolidated bill not found' },
        { status: 404 }
      );
    }

    // Verify the bill belongs to the authenticated user
    if (consolidatedBill.userId !== auth.userId) {
      logger.error(`Unauthorized access: bill user ${consolidatedBill.userId}, auth user ${auth.userId}`);
      return NextResponse.json(
        { error: 'Unauthorized access to consolidated bill' },
        { status: 403 }
      );
    }

    logger.info(`Bill verified, has ${consolidatedBill.autoPaymentRecords?.length || 0} payment records`);

    // Generate PDF
    logger.info(`Generating PDF for consolidated bill ${id}`);
    const pdfBuffer = await pdfService.generateConsolidatedBillPDF(id);
    logger.info(`PDF buffer created, size: ${pdfBuffer.length} bytes`);

    // Return PDF with appropriate headers
    // Requirement 5.4: Allow Users to download the Consolidated_Bill as a PDF document
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="consolidated-bill-${id}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error({ error, stack: error instanceof Error ? error.stack : undefined }, 'Error in PDF download endpoint');

    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
