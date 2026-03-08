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

        // Find the current active cycle
        const activeCycle = await PaymentCycle.findOne({
            userId,
            status: 'active',
        });

        if (!activeCycle) {
            return NextResponse.json({ error: 'No active payment cycle found' }, { status: 400 });
        }

        // Check if there are any successful auto payments
        const autoPaymentRecords = await AutoPaymentRecord.find({
            userId,
            paymentCycleId: activeCycle._id.toString(),
            status: { $in: ['success', 'settled'] },
        });

        if (autoPaymentRecords.length === 0) {
            return NextResponse.json({ error: 'No successful auto-payments in current cycle to consolidate' }, { status: 400 });
        }

        // Close the current cycle early (this will also create a new one)
        await paymentCycleService.closePaymentCycle(activeCycle._id.toString());

        // Generate the consolidated bill for the newly closed cycle
        const consolidatedBill = await aggregationEngine.generateConsolidatedBill(
            userId,
            activeCycle._id.toString()
        );

        return NextResponse.json({
            success: true,
            data: consolidatedBill,
            message: 'Consolidated bill generated successfully'
        });
    } catch (error: any) {
        console.error('Error generating consolidated bill manually:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate consolidated bill' },
            { status: 500 }
        );
    }
}
