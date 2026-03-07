import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { validateInternalRequest } from '@/lib/utils/internal-api';

const MAX_BILLS_PER_USER = 10;

/**
 * POST /api/bills/link
 * Link an existing admin-created bill to the authenticated regular user
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

        const body = await request.json();
        const { billId } = body;

        if (!billId) {
            return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
        }

        const db = await getDatabase();
        const bills = db.collection('bills');

        // Check how many bills the user already has
        const currentBillCount = await bills.countDocuments({
            $or: [{ userId: authResult.user.id }, { linkedUserIds: authResult.user.id }]
        });
        if (currentBillCount >= MAX_BILLS_PER_USER) {
            return NextResponse.json(
                { error: `You can only add up to ${MAX_BILLS_PER_USER} bills.` },
                { status: 400 }
            );
        }

        // Find the bill
        let query: any = {};
        if (ObjectId.isValid(billId)) {
            query = { _id: new ObjectId(billId) };
        } else {
            query = { billId: billId };
        }

        const bill = await bills.findOne(query);
        if (!bill) {
            return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
        }

        // Check if bill is already assigned to a user
        if ((bill.userId && bill.userId === authResult.user.id) ||
            (bill.linkedUserIds && bill.linkedUserIds.includes(authResult.user.id))) {
            return NextResponse.json({ error: 'This bill is already linked to your account' }, { status: 400 });
        }

        // We could restrict linking if the bill already belongs to someone else:
        // if (bill.userId && bill.userId !== authResult.user.id) {
        //   return NextResponse.json({ error: 'This bill is linked to another user' }, { status: 400 });
        // }
        // However, if users share an electricity bill, they might both want it. Let's allow duplication or reassignment
        // If we only want linking, we update the existing object.
        // Safest option: just assign it to the user if they found it.
        await bills.updateOne(query, { $addToSet: { linkedUserIds: authResult.user.id } });

        return NextResponse.json({
            success: true,
            message: 'Bill linked successfully',
        });
    } catch (error) {
        console.error('Error linking bill:', error);
        return NextResponse.json(
            { error: 'Failed to link bill' },
            { status: 500 }
        );
    }
}
