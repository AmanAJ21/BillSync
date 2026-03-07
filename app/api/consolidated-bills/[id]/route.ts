import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import ConsolidatedBill from '@/lib/models/ConsolidatedBill';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * GET /api/consolidated-bills/[id]
 * Get consolidated bill details with itemized bills
 * Validates: Requirements 5.2, 5.3
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
      return auth.error;
    }

    // Await params to get the id
    const { id } = await params;

    // Find the consolidated bill
    const consolidatedBill = await ConsolidatedBill.findById(id).lean();

    if (!consolidatedBill) {
      return NextResponse.json(
        { error: 'Consolidated bill not found' },
        { status: 404 }
      );
    }

    // Verify the bill belongs to the authenticated user
    if (consolidatedBill.userId !== auth.userId) {
      return NextResponse.json(
        { error: 'Unauthorized access to consolidated bill' },
        { status: 403 }
      );
    }

    // Fetch all auto payment records for this consolidated bill
    // Requirement 5.3: Display itemized list of Individual_Bills
    const autoPaymentRecords = await AutoPaymentRecord.find({
      _id: { $in: consolidatedBill.autoPaymentRecords }
    })
      .sort({ paymentDate: -1 })
      .lean();

    // Format itemized bills with provider name, bill type, amount, and payment date
    // Requirement 4.4: List each Individual_Bill with provider name, bill type, amount, and payment date
    const itemizedBills = autoPaymentRecords.map(record => ({
      _id: record._id.toString(),
      billId: record.billId,
      billProvider: record.billProvider,
      billType: record.billType,
      amount: record.amount,
      paymentDate: record.paymentDate,
      transactionId: record.transactionId,
      status: record.status,
    }));

    // Format response with all required fields
    // Requirement 5.3: Display total amount, Payment_Cycle period, and itemized list
    const response = {
      _id: consolidatedBill._id.toString(),
      userId: consolidatedBill.userId,
      paymentCycleId: consolidatedBill.paymentCycleId,
      cycleStartDate: consolidatedBill.cycleStartDate,
      cycleEndDate: consolidatedBill.cycleEndDate,
      totalAmount: consolidatedBill.totalAmount,
      status: consolidatedBill.status,
      paidAt: consolidatedBill.paidAt,
      razorpayOrderId: consolidatedBill.razorpayOrderId,
      createdAt: consolidatedBill.createdAt,
      updatedAt: consolidatedBill.updatedAt,
      autoPaymentRecords: itemizedBills,
    };

    return NextResponse.json({ bill: response });
  } catch (error) {
    logger.error({ error }, 'Error in get consolidated bill details endpoint');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to get consolidated bill details';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
