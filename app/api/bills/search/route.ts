import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { validateInternalRequest } from '@/lib/utils/internal-api';

/**
 * GET /api/bills/search
 * Search for admin-created bills by bill number and/or provider
 * Regular users use this to find and add existing bills to their account
 */
export async function GET(request: NextRequest) {
    // Validate internal request
    const validationError = validateInternalRequest(request);
    if (validationError) return validationError;

    try {
        const { searchParams } = new URL(request.url);
        const billNumber = searchParams.get('billNumber')?.trim() || '';
        const provider = searchParams.get('provider')?.trim() || '';
        const billType = searchParams.get('billType')?.trim() || '';

        if (!billNumber && !provider && !billType) {
            return NextResponse.json(
                { error: 'Please provide a bill number, provider, or bill type to search' },
                { status: 400 }
            );
        }

        const db = await getDatabase();
        const bills = db.collection('bills');

        // Build search query - case-insensitive partial match
        const query: any = {};

        if (billNumber) {
            query.billNumber = { $regex: billNumber, $options: 'i' };
        }

        if (provider) {
            query.providerName = { $regex: provider, $options: 'i' };
        }

        if (billType) {
            query.type = billType;
        }

        // Search for matching bills
        const matchingBills = await bills
            .find(query)
            .project({
                _id: 1,
                billNumber: 1,
                providerName: 1,
                type: 1,
                billingFrequency: 1,
                dueDate: 1,
                billingPeriod: 1,
                customerName: 1,
                accountNumber: 1,
                unitsConsumed: 1,
                dataUsed: 1,
                channels: 1,
                breakdown: 1,
                title: 1,
                description: 1,
                createdAt: 1,
            })
            .limit(20)
            .toArray();

        // Also search admin-created bills collection (the adminBills pattern)
        // Search with provider field too (admin bills use 'provider' not 'providerName')
        const adminQuery: any = {};
        if (billNumber) {
            adminQuery.billNumber = { $regex: billNumber, $options: 'i' };
        }
        if (provider) {
            adminQuery.provider = { $regex: provider, $options: 'i' };
        }
        if (billType) {
            adminQuery.billType = billType;
        }

        const adminBills = await bills
            .find(adminQuery)
            .project({
                _id: 1,
                billNumber: 1,
                provider: 1,
                providerName: 1,
                billType: 1,
                type: 1,
                billingFrequency: 1,
                dueDay: 1,
                dueDate: 1,
                billingPeriod: 1,
                customerName: 1,
                accountNumber: 1,
                unitsConsumed: 1,
                dataUsed: 1,
                channels: 1,
                breakdown: 1,
                title: 1,
                description: 1,
                createdAt: 1,
            })
            .limit(20)
            .toArray();

        // Merge and deduplicate results
        const allBillsMap = new Map();
        [...matchingBills, ...adminBills].forEach(bill => {
            const id = bill._id.toString();
            if (!allBillsMap.has(id)) {
                allBillsMap.set(id, {
                    ...bill,
                    _id: id,
                    provider: bill.provider || bill.providerName || '',
                    billType: bill.billType || bill.type || '',
                });
            }
        });

        const results = Array.from(allBillsMap.values());

        return NextResponse.json({
            success: true,
            bills: results,
            total: results.length,
        });
    } catch (error) {
        console.error('Error searching bills:', error);
        return NextResponse.json(
            { error: 'Failed to search bills' },
            { status: 500 }
        );
    }
}
