import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import Bill from '@/lib/models/Bill';
import connectDB from '@/lib/mongoose';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

/**
 * GET /api/bills
 * Get all bills for authenticated user
 */
export async function GET(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    const bills = await db.collection('bills')
      .find({
        $or: [{ userId: authResult.user.id }, { linkedUserIds: authResult.user.id }]
      })
      .sort({ dueDate: 1 })
      .toArray();

    // Map _id to string for JSON serialization
    const mappedBills = bills.map((bill: any) => ({
      ...bill,
      _id: bill._id.toString()
    }));

    return NextResponse.json({ bills: mappedBills }, { status: 200 });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

/**
 * POST /api/bills
 * Create a new bill
 */
export async function POST(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { provider, billType, dueDate, accountNumber, description } = body;

    // Validate required fields
    if (!provider || !billType || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, billType, dueDate' },
        { status: 400 }
      );
    }

    // Generate unique billId
    const billId = `bill-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const bill = await Bill.create({
      userId: authResult.user.id,
      billId,
      provider,
      billType,
      dueDate: new Date(dueDate),
      accountNumber,
      description,
    });

    return NextResponse.json({ bill }, { status: 201 });
  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
  }
}
