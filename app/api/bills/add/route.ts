import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

const MAX_BILLS_PER_USER = 4;

export async function POST(request: NextRequest) {
    // Validate internal request
    const validationError = validateInternalRequest(request);
    if (validationError) return validationError;

    try {
        const body = await request.json();
        const { type, accountNumber, provider, billDetails, autoPayEnabled } = body;

        // Extract externalBillId from billDetails if available
        const externalBillId = billDetails?.externalBillId || null;

        // Save to local MongoDB database
        const db = await getDatabase();
        const bills = db.collection('bills');

        // Check current bill count
        const currentBillCount = await bills.countDocuments({});

        if (currentBillCount >= MAX_BILLS_PER_USER) {
            return NextResponse.json(
                { error: `You can only add up to ${MAX_BILLS_PER_USER} bills. Please remove an existing bill to add a new one.` },
                { status: 400 }
            );
        }

        // Check if the exact same bill already exists (same account, provider, and bill number)
        const existingBill = await bills.findOne({
            accountNumber,
            providerName: provider,
            billNumber: billDetails.billNumber
        });

        if (existingBill) {
            return NextResponse.json(
                { error: 'This specific bill is already added to your account.' },
                { status: 400 }
            );
        }

        const billRecord = {
            type,
            accountNumber,
            providerName: provider,
            externalBillId: externalBillId || null, // Store external bill ID from API
            billNumber: billDetails.billNumber,
            dueDate: billDetails.dueDate,
            billingPeriod: billDetails.billingPeriod,
            customerName: billDetails.customerName,
            autoPayEnabled: true,
            status: 'pending',
            title: `${provider} - ${type.replace('_', ' ')}`,
            description: `Billing Period: ${billDetails.billingPeriod}`,
            unitsConsumed: billDetails.unitsConsumed,
            dataUsed: billDetails.dataUsed,
            channels: billDetails.channels,
            breakdown: billDetails.breakdown,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await bills.insertOne(billRecord);

        return NextResponse.json({
            success: true,
            message: 'Bill added successfully. Automatic payment is enabled.',
            data: {
                id: result.insertedId.toString(),
                ...billRecord
            }
        });

    } catch (error) {
        console.error('Error adding bill:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to add bill' },
            { status: 500 }
        );
    }
}
