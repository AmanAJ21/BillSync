import { NextRequest, NextResponse } from 'next/server';
import { validateInternalRequest } from '@/lib/utils/internal-api';
import { verifyAuth } from '@/lib/middleware/auth';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // Validate internal request
    const validationError = validateInternalRequest(request);
    if (validationError) return validationError;

    try {
        // Verify authentication
        const authResult = await verifyAuth(request);
        if (!authResult.authenticated || !authResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        console.log('Attempting to delete bill with ID:', id);

        const db = await getDatabase();
        const bills = db.collection('bills');

        let query: any = {};
        if (ObjectId.isValid(id) && new ObjectId(id).toString() === id) {
            query = { _id: new ObjectId(id) };
        } else {
            query = { _id: id }; // Try string _id if added like that
            // Or try billId field
            const billByStringId = await bills.findOne(query);
            if (!billByStringId) {
                query = { billId: id };
            }
        }

        // Find the bill
        const bill = await bills.findOne(query);

        if (!bill) {
            // Also try one more check for billId just in case ObjectId was valid but was actually a string billId
            const altBill = await bills.findOne({ billId: id });
            if (altBill) {
                query = { billId: id };
                Object.assign(bill || {}, altBill);
            } else {
                return NextResponse.json(
                    { error: 'Bill not found' },
                    { status: 404 }
                );
            }
        }

        const currentBill = bill || await bills.findOne(query);

        if (!currentBill) {
            return NextResponse.json(
                { error: 'Bill not found' },
                { status: 404 }
            );
        }

        // Verify ownership - check if the bill belongs to the authenticated user
        const isOwner = currentBill.userId === authResult.user.id;
        const isLinked = currentBill.linkedUserIds && currentBill.linkedUserIds.includes(authResult.user.id);

        if (!isOwner && !isLinked) {
            return NextResponse.json(
                { error: 'Access denied to this bill' },
                { status: 403 }
            );
        }

        if (isOwner) {
            // Delete the bill
            await bills.deleteOne(query);

            // Note: If you have auto payments associated, you might want to clean them up here
        } else {
            // Unlink the user
            await bills.updateOne(query, { $pull: { linkedUserIds: authResult.user.id as any } });
        }

        console.log('Bill removed successfully');

        return NextResponse.json({
            success: true,
            message: 'Bill removed successfully'
        });

    } catch (error) {
        console.error('Error deleting bill:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete bill' },
            { status: 500 }
        );
    }
}
