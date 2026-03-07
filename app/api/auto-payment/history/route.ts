import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/utils/auth-helper';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';
import logger from '@/lib/logger';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

/**
 * GET /api/auto-payment/history
 * Retrieve auto-payment transaction history with pagination and filtering
 * Validates: Requirements 3.2, 3.4
 */
export async function GET(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    // Authenticate user
    const auth = authenticateRequest(request);
    if (auth.error) {
      return auth.error;
    }

    // Extract query parameters
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // Date range filtering
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Build query filter
    const filter: any = { userId: auth.userId };

    // Add date range filter if provided
    if (startDate || endDate) {
      filter.paymentDate = {};
      
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return NextResponse.json(
            { error: 'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)' },
            { status: 400 }
          );
        }
        filter.paymentDate.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return NextResponse.json(
            { error: 'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)' },
            { status: 400 }
          );
        }
        filter.paymentDate.$lte = end;
      }
    }

    // Query auto-payment records with pagination
    const [records, totalCount] = await Promise.all([
      AutoPaymentRecord.find(filter)
        .sort({ paymentDate: -1 }) // Most recent first
        .skip(offset)
        .limit(limit)
        .lean(),
      AutoPaymentRecord.countDocuments(filter),
    ]);

    // Format response with auto-payment indicators
    const formattedRecords = records.map(record => ({
      id: record._id.toString(),
      userId: record.userId,
      billId: record.billId,
      amount: record.amount,
      paymentDate: record.paymentDate,
      transactionId: record.transactionId,
      billProvider: record.billProvider,
      billType: record.billType,
      status: record.status,
      paymentCycleId: record.paymentCycleId,
      isAutoPaid: true, // Clear indicator that this was automatically paid
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    logger.info(
      {
        userId: auth.userId,
        page,
        limit,
        totalCount,
        startDate,
        endDate,
      },
      'Retrieved auto-payment history'
    );

    return NextResponse.json({
      records: formattedRecords,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error in auto-payment history endpoint');
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve auto-payment history';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
