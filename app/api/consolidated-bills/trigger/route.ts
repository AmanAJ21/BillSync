import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { validateInternalRequest } from '@/lib/utils/internal-api';
import PaymentCycle from '@/lib/models/PaymentCycle';
import { paymentCycleService } from '@/lib/services/PaymentCycleService';
import { aggregationEngine } from '@/lib/services/AggregationEngine';
import { connectDB } from '@/lib/mongoose';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';

export async function POST(request: NextRequest) {
    const validationError = validateInternalRequest(request);
    if (validationError) return validationError;

    try {
        await connectDB();
        const authResult = await verifyAuth(request);
        if (!authResult.authenticated || !authResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = authResult.user.id;

        const successfulRecords = await AutoPaymentRecord.find({
            userId,
            status: { $in: ['success', 'settled'] },
        });

        if (successfulRecords.length === 0) {
            return NextResponse.json({ error: 'No successful auto-payments available to consolidate' }, { status: 400 });
        }

        // Group records by paymentCycleId
        const cycleIds = new Set<string>();
        successfulRecords.forEach(record => cycleIds.add(record.paymentCycleId));

        let generatedCount = 0;

        for (const cycleId of Array.from(cycleIds)) {
            const cycle = await PaymentCycle.findById(cycleId);
            if (!cycle) continue;

            if (cycle.status === 'active') {
                await paymentCycleService.closePaymentCycle(cycle._id.toString());
            }

            // Generate or update the consolidated bill
            await aggregationEngine.generateConsolidatedBill(
                userId,
                cycle._id.toString()
            );
            generatedCount++;
        }

        return NextResponse.json({
            success: true,
            data: { generatedCount },
            message: `Consolidated ${generatedCount} payment cycle(s) successfully`
        });
    } catch (error: any) {
        console.error('Error generating consolidated bill manually:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate consolidated bill' },
            { status: 500 }
        );
    }
}
