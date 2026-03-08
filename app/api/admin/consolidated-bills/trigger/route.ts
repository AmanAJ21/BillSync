import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { connectDB } from '@/lib/mongoose';
import PaymentCycle from '@/lib/models/PaymentCycle';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';
import { paymentCycleService } from '@/lib/services/PaymentCycleService';
import { aggregationEngine } from '@/lib/services/AggregationEngine';
import logger from '@/lib/logger';
import { validateInternalRequest } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    // Validate internal request
    const validationError = validateInternalRequest(request);
    if (validationError) return validationError;

    try {
        // Authenticate and verify admin
        await connectDB();
        const authResult = await verifyAuth(request);
        if (!authResult.authenticated || !authResult.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user role from database
        const db = await getDatabase();
        const users = db.collection('users');
        const adminUser = await users.findOne({ _id: new ObjectId(authResult.user.id) });

        if (!adminUser || adminUser.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        logger.info(
            { adminId: authResult.user.id },
            'Admin manually triggering consolidated bills generation for all users'
        );

        // Get all active payment cycles
        const activeCycles = await PaymentCycle.find({ status: 'active' });
        let generatedCount = 0;
        const processingErrors: any[] = [];

        for (const cycle of activeCycles) {
            try {
                // Check if there are any successful auto payments
                const autoPaymentRecords = await AutoPaymentRecord.find({
                    userId: cycle.userId,
                    paymentCycleId: cycle._id.toString(),
                    status: { $in: ['success', 'settled'] },
                });

                if (autoPaymentRecords.length > 0) {
                    // Close the current cycle early (this will also create a new one)
                    await paymentCycleService.closePaymentCycle(cycle._id.toString());

                    // Generate the consolidated bill for the newly closed cycle
                    await aggregationEngine.generateConsolidatedBill(
                        cycle.userId,
                        cycle._id.toString()
                    );
                    generatedCount++;
                }
            } catch (err: any) {
                processingErrors.push({ userId: cycle.userId, error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Consolidated bills generation completed',
            data: {
                generatedCount,
                errors: processingErrors
            }
        });
    } catch (error) {
        logger.error({ error }, 'Error in admin consolidated bills trigger endpoint');

        const errorMessage = error instanceof Error ? error.message : 'Failed to trigger generation';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
