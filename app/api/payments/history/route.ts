import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/middleware/auth';
import { manualPaymentService } from '@/lib/services/ManualPaymentService';
import { handleError, errors } from '@/lib/middleware/errorHandler';
import ConsolidatedBill from '@/lib/models/ConsolidatedBill';
import connectDB from '@/lib/mongoose';

/**
 * GET /api/payments/history
 * Get complete payment history (manual + consolidated) for the authenticated user
 * Requires authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return errors.unauthorized('Authentication required');
    }

    const userId = authResult.user.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') as 'success' | 'failed' | 'pending' | 'paid' | null;
    const billType = searchParams.get('billType') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Validate pagination
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return errors.badRequest('Invalid pagination parameters. Page must be >= 1, limit must be 1-100');
    }

    await connectDB();

    // Build filters for manual payments
    const manualFilters: any = { userId };

    if (status && ['success', 'failed', 'pending'].includes(status)) {
      manualFilters.status = status;
    }

    if (billType) {
      manualFilters.billType = billType;
    }

    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return errors.badRequest('Invalid startDate format. Use ISO 8601 format');
      }
      manualFilters.startDate = start;
    }

    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return errors.badRequest('Invalid endDate format. Use ISO 8601 format');
      }
      manualFilters.endDate = end;
    }

    // Get manual payments
    const manualResult = await manualPaymentService.getPayments(manualFilters, 1, 1000);

    // Get consolidated bill payments
    const consolidatedQuery: any = { userId, status: 'paid' };
    
    if (startDate || endDate) {
      consolidatedQuery.paidAt = {};
      if (startDate) {
        consolidatedQuery.paidAt.$gte = new Date(startDate);
      }
      if (endDate) {
        consolidatedQuery.paidAt.$lte = new Date(endDate);
      }
    }

    const consolidatedBills = await ConsolidatedBill.find(consolidatedQuery)
      .sort({ paidAt: -1 })
      .lean();

    // Transform consolidated bills to match payment format
    const consolidatedPayments = consolidatedBills.map((bill: any) => ({
      _id: bill._id.toString(),
      transactionId: bill.razorpayOrderId || `CB-${bill._id.toString().slice(-8)}`,
      billId: bill._id.toString(),
      amount: bill.totalAmount,
      paymentDate: bill.paidAt || bill.updatedAt,
      status: 'settled',
      billProvider: 'Consolidated Bill',
      billType: 'consolidated',
      razorpayOrderId: bill.razorpayOrderId,
      recordMonth: `${new Date(bill.cycleStartDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} - ${new Date(bill.cycleEndDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
      createdAt: bill.createdAt,
      isConsolidated: true,
      paymentCycleId: bill.paymentCycleId,
      recordCount: bill.autoPaymentRecords?.length || 0,
    }));

    // Combine and sort all payments by date
    const allPayments = [...manualResult.payments, ...consolidatedPayments]
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

    // Apply status filter to combined results
    let filteredPayments = allPayments;
    if (status === 'paid') {
      // Show only consolidated bills when filtering by 'paid'
      filteredPayments = allPayments.filter(p => p.status === 'settled' && (p as any).isConsolidated);
    } else if (status) {
      filteredPayments = allPayments.filter(p => p.status === status);
    }

    // Apply pagination
    const total = filteredPayments.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

    return NextResponse.json({
      payments: paginatedPayments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
