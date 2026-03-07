import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/middleware/role';
import { getDatabase } from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';

/**
 * GET /api/admin/users/[userId]/bills
 * Get bills for a specific user
 * Requires admin role
 * Validates: Requirements 6.4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
    const { userId } = await params;

    // Validate userId format (MongoDB ObjectId)
    if (!userId || userId.length !== 24) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query
    const query: any = { userId };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.dueDate = {};
      if (startDate) {
        query.dueDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.dueDate.$lte = new Date(endDate);
      }
    }

    // Get bills from database
    const db = await getDatabase();
    const bills = db.collection('bills');

    // First verify the user exists
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's bills
    const userBills = await bills
      .find(query)
      .sort({ dueDate: -1 })
      .toArray();

    // Convert ObjectIds to strings
    const formattedBills = userBills.map(bill => ({
      ...bill,
      _id: bill._id?.toString(),
      userId: bill.userId
    }));

    return NextResponse.json({
      bills: formattedBills,
      user: {
        id: user._id?.toString(),
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Error fetching user bills:', error);

    // Handle date parsing errors
    if (error instanceof Error && error.message.includes('Invalid Date')) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD format.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch user bills' },
      { status: 500 }
    );
  }
}