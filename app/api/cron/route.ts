import { NextRequest, NextResponse } from 'next/server';
import { processAutoPayments } from '@/lib/jobs/autoPaymentProcessor';
import { managePaymentCycles } from '@/lib/jobs/paymentCycleManager';
import { generateConsolidatedBills } from '@/lib/jobs/consolidatedBillGenerator';
import { connectDB } from '@/lib/mongoose';
import logger from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron
 * Master cron job for the BillSync application
 * Handles:
 * 1. Automatic Payment Processing
 * 2. Payment Cycle Management (Ending old cycles, starting new ones)
 * 3. Consolidated Bill Generation
 * 
 * Securely triggered by Vercel Cron or manual calls with CRON_SECRET
 */
export async function GET(request: NextRequest) {
    // Security check: Only allow calls with the correct CRON_SECRET
    const authHeader = request.headers.get('authorization');

    // Also check if we are in development and might want to skip the check
    const isDev = process.env.NODE_ENV === 'development';
    const cronSecret = process.env.CRON_SECRET || 'dev_secret';

    if (!isDev && authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('Unauthorized attempt to trigger cron job');
        return new NextResponse('Unauthorized', { status: 401 });
    }

    logger.info('Master cron job triggered');

    try {
        // Ensure database connection
        await connectDB();

        const results: any = {
            timestamp: new Date().toISOString()
        };

        // 1. Process Auto-Payments
        // Processes all enabled bills that are due within the scheduled window
        try {
            results.autoPayments = await processAutoPayments();
        } catch (err: any) {
            logger.error({ err }, 'Auto-payment processing failed in cron');
            results.autoPayments = { success: false, error: err.message };
        }

        // 2. Manage Payment Cycles
        // Closes cycles that have ended and initializes new ones
        try {
            results.cycles = await managePaymentCycles();
        } catch (err: any) {
            logger.error({ err }, 'Payment cycle management failed in cron');
            results.cycles = { success: false, error: err.message };
        }

        // 3. Generate Consolidated Bills
        // Generates bills for users whose cycles just ended
        try {
            results.consolidation = await generateConsolidatedBills();
        } catch (err: any) {
            logger.error({ err }, 'Consolidated bill generation failed in cron');
            results.consolidation = { success: false, error: err.message };
        }

        return NextResponse.json({
            success: true,
            ...results
        });
    } catch (error: any) {
        logger.error({ error }, 'Master cron job critical failure');
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}
