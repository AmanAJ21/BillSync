import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/middleware/role';
import AutoPaymentRecord from '../../../../lib/models/AutoPaymentRecord';
import ManualPayment from '../../../../lib/models/ManualPayment';
import { connectDB } from '../../../../lib/mongoose';
import { handleError, errors } from '../../../../lib/middleware/errorHandler';

/**
 * GET /api/admin/transactions
 * Get all payment transactions (both manual and auto) with filtering and pagination
 * Requires admin role
 * Validates: Requirements 14.1, 14.2, 14.3
 */
export async function GET(request: NextRequest) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
    await connectDB();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const userId = searchParams.get('userId') || undefined;
    const status = searchParams.get('status') as 'success' | 'failed' | 'settled' | 'pending' | undefined;
    const paymentType = searchParams.get('paymentType') as 'manual' | 'auto' | undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // Validate pagination parameters
    if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
      return errors.badRequest('Invalid pagination parameters. Page must be >= 1, limit must be 1-100');
    }

    // Validate status parameter
    if (status && !['success', 'failed', 'settled', 'pending'].includes(status)) {
      return errors.badRequest('Invalid status. Must be one of: success, failed, settled, pending');
    }

    // Validate payment type parameter
    if (paymentType && !['manual', 'auto'].includes(paymentType)) {
      return errors.badRequest('Invalid paymentType. Must be one of: manual, auto');
    }

    // Build filter query
    const filter: any = {};

    if (userId) {
      filter.userId = userId;
    }

    if (status) {
      filter.status = status;
    }

    // Date range filtering
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return errors.badRequest('Invalid startDate format. Use ISO 8601 format');
        }
        filter.paymentDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return errors.badRequest('Invalid endDate format. Use ISO 8601 format');
        }
        filter.paymentDate.$lte = end;
      }
    }

    let allTransactions: any[] = [];
    let total = 0;

    // Fetch based on payment type filter
    if (!paymentType || paymentType === 'auto') {
      const [autoTransactions, autoTotal] = await Promise.all([
        AutoPaymentRecord.find(filter)
          .sort({ paymentDate: -1 })
          .lean(),
        AutoPaymentRecord.countDocuments(filter)
      ]);
      
      allTransactions.push(...autoTransactions.map((t: any) => ({
        ...t,
        paymentType: 'auto',
        _id: t._id.toString(),
      })));
      total += autoTotal;
    }

    if (!paymentType || paymentType === 'manual') {
      const [manualTransactions, manualTotal] = await Promise.all([
        ManualPayment.find(filter)
          .sort({ paymentDate: -1 })
          .lean(),
        ManualPayment.countDocuments(filter)
      ]);
      
      allTransactions.push(...manualTransactions.map((t: any) => ({
        ...t,
        paymentType: 'manual',
        _id: t._id.toString(),
      })));
      total += manualTotal;
    }

    // Sort all transactions by payment date (most recent first)
    allTransactions.sort((a, b) => {
      const dateA = new Date(a.paymentDate).getTime();
      const dateB = new Date(b.paymentDate).getTime();
      return dateB - dateA;
    });

    // Apply pagination to combined results
    const skip = (page - 1) * limit;
    const paginatedTransactions = allTransactions.slice(skip, skip + limit);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      transactions: paginatedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    return handleError(error);
  }
}