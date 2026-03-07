import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/middleware/role';
import { verifyAuth } from '../../../../../../lib/middleware/auth';
import { getDatabase } from '../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { auditLogService } from '../../../../../../lib/services/AuditLogService';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ billId: string }> }
) {
    const authCheck = await requireAdmin(request);
    if (authCheck) return authCheck;

    try {
        const authResult = await verifyAuth(request);
        if (!authResult.authenticated || !authResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { billId } = await params;
        const body = await request.json();
        const { month, amount, description } = body;

        if (!month || amount == null) {
            return NextResponse.json({ error: 'Month and amount are required' }, { status: 400 });
        }

        const db = await getDatabase();
        const bills = db.collection('bills');

        // Find the bill
        let query: any = {};
        if (ObjectId.isValid(billId) && new ObjectId(billId).toString() === billId) {
            query = { _id: new ObjectId(billId) };
        } else {
            query = { billId: billId };
        }

        const currentBill = await bills.findOne(query);
        if (!currentBill) {
            return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
        }

        const recordId = new ObjectId().toString();

        // Calculate due date based on the bill's dueDay and the provided month (YYYY-MM)
        const [yearStr, monthStr] = month.split('-');
        const year = parseInt(yearStr);
        const monthIndex = parseInt(monthStr) - 1; // 0-indexed

        let calculatedDueDate = new Date();
        if (currentBill.dueDay) {
            // Calculate true due date (handles short months organically by wrapping or stopping at the end of month)
            // To cap at the end of the month instead of wrapping into the next:
            const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
            const actualDueDay = Math.min(currentBill.dueDay, lastDayOfMonth);
            calculatedDueDate = new Date(year, monthIndex, actualDueDay);
        } else {
            // Default to 1st of the month if no dueDay exists
            calculatedDueDate = new Date(year, monthIndex, 1);
        }

        const newRecord = {
            id: recordId,
            month,
            amount: Number(amount),
            dueDate: calculatedDueDate,
            description: description || '',
            status: 'pending',
            createdAt: new Date()
        };

        const updateResult = await bills.findOneAndUpdate(
            query,
            { $push: { monthlyRecords: newRecord } as any },
            { returnDocument: 'after' }
        );

        if (!updateResult) {
            return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
        }

        // Log audit event
        await auditLogService.logBillRecordCreate(
            authResult.user.id,
            billId,
            recordId,
            { month, amount, description, dueDate: calculatedDueDate },
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
            request.headers.get('user-agent') || undefined
        );

        return NextResponse.json({
            success: true,
            message: 'Monthly bill record added successfully',
            bill: updateResult
        });
    } catch (error: any) {
        console.error('Error adding monthly bill record:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
