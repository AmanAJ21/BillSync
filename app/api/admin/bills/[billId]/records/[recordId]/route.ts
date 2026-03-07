import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../../lib/middleware/role';
import { verifyAuth } from '../../../../../../../lib/middleware/auth';
import { getDatabase } from '../../../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { auditLogService } from '../../../../../../../lib/services/AuditLogService';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ billId: string; recordId: string }> }
) {
    const authCheck = await requireAdmin(request);
    if (authCheck) return authCheck;

    try {
        const authResult = await verifyAuth(request);
        if (!authResult.authenticated || !authResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { billId, recordId } = await params;

        const db = await getDatabase();
        const bills = db.collection('bills');

        let query: any = {};
        if (ObjectId.isValid(billId) && new ObjectId(billId).toString() === billId) {
            query = { _id: new ObjectId(billId) };
        } else {
            query = { billId: billId };
        }

        // Get the record before deletion for audit log
        const currentBill = await bills.findOne(query);
        if (!currentBill) {
            return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
        }

        const recordToDelete = (currentBill as any).monthlyRecords?.find((r: any) => r.id === recordId);

        const updateResult = await bills.findOneAndUpdate(
            query,
            { $pull: { monthlyRecords: { id: recordId } } as any },
            { returnDocument: 'after' }
        );

        if (!updateResult) {
            return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
        }

        // Log audit event if record was found
        if (recordToDelete) {
            await auditLogService.logBillRecordDelete(
                authResult.user.id,
                billId,
                recordId,
                recordToDelete,
                request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
                request.headers.get('user-agent') || undefined
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Monthly bill record deleted successfully',
            bill: updateResult
        });
    } catch (error: any) {
        console.error('Error deleting monthly bill record:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ billId: string; recordId: string }> }
) {
    const authCheck = await requireAdmin(request);
    if (authCheck) return authCheck;

    try {
        const authResult = await verifyAuth(request);
        if (!authResult.authenticated || !authResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { billId, recordId } = await params;
        const body = await request.json();
        const { status } = body;

        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 });
        }

        const db = await getDatabase();
        const bills = db.collection('bills');

        let query: any = {};
        if (ObjectId.isValid(billId) && new ObjectId(billId).toString() === billId) {
            query = { _id: new ObjectId(billId), "monthlyRecords.id": recordId };
        } else {
            query = { billId: billId, "monthlyRecords.id": recordId };
        }

        // Get the record before update for audit log
        const currentBill = await bills.findOne(
            ObjectId.isValid(billId) && new ObjectId(billId).toString() === billId
                ? { _id: new ObjectId(billId) }
                : { billId: billId }
        );
        const recordBefore = (currentBill as any)?.monthlyRecords?.find((r: any) => r.id === recordId);

        const updateResult = await bills.findOneAndUpdate(
            query,
            { $set: { "monthlyRecords.$.status": status } as any },
            { returnDocument: 'after' }
        );

        if (!updateResult) {
            return NextResponse.json({ error: 'Bill or record not found' }, { status: 404 });
        }

        // Log audit event if record was found
        if (recordBefore) {
            const recordAfter = (updateResult as any).monthlyRecords?.find((r: any) => r.id === recordId);
            await auditLogService.logBillRecordUpdate(
                authResult.user.id,
                billId,
                recordId,
                { status: recordBefore.status },
                { status: recordAfter?.status || status },
                request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
                request.headers.get('user-agent') || undefined
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Monthly bill record status updated successfully',
            bill: updateResult
        });
    } catch (error: any) {
        console.error('Error updating monthly bill record status:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
