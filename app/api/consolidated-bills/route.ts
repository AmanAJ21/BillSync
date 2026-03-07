import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { consolidatedBillHistoryService } from '@/lib/services/ConsolidatedBillHistoryService';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

/**
 * GET /api/consolidated-bills
 * List all consolidated bills for authenticated user with pagination
 * Validates: Requirement 5.2, 5.5
 */
export async function GET(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    // Authenticate user
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Get paginated history
    const result = await consolidatedBillHistoryService.getConsolidatedBillHistoryPaginated(
      userId,
      page,
      limit
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching consolidated bills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch consolidated bills' },
      { status: 500 }
    );
  }
}
