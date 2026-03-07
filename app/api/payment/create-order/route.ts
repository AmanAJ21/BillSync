import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export async function POST(request: NextRequest) {
    // Validate internal request
    const validationError = validateInternalRequest(request);
    if (validationError) return validationError;

    try {
        const { billId, recordId } = await request.json();
        console.log('Payment Request:', { billId, recordId });

        let query: any = {};
        if (ObjectId.isValid(billId)) {
            query = { _id: new ObjectId(billId) };
        } else {
            console.warn('billId is not a valid ObjectId, falling back to billId field:', billId);
            query = { billId: billId };
        }

        const db = await getDatabase();
        const bills = db.collection('bills');
        const bill = await bills.findOne(query);

        if (!bill) {
            console.error('Bill not found for ID:', billId);
            return NextResponse.json(
                { error: 'Bill not found' },
                { status: 404 }
            );
        }

        console.log('Retrieved Bill:', {
            _id: bill._id,
            amount: bill.amount,
            totalAmount: bill.totalAmount,
            recordsCount: bill.monthlyRecords?.length
        });

        let paymentAmount = bill.totalAmount || bill.amount || 0;
        // Shorten receipt label (max 40 chars for Razorpay)
        let receiptLabel = `b_${billId}`.substring(0, 40);
        const notes: any = {
            billId: billId,
            accountNumber: bill.accountNumber,
            provider: bill.providerName || bill.provider,
            type: bill.type || bill.billType
        };

        if (recordId) {
            const record = bill.monthlyRecords?.find((r: any) => r.id === recordId);
            if (!record) {
                console.error('Record not found in bill:', { billId, recordId });
                return NextResponse.json({ error: 'Monthly record not found' }, { status: 404 });
            }
            if (record.status === 'paid') {
                return NextResponse.json({ error: 'This record is already paid' }, { status: 400 });
            }
            paymentAmount = record.amount;
            // Shorten combined receipt label
            receiptLabel = `b_${billId}_r_${recordId}`.substring(0, 40);
            notes.recordId = recordId;
            notes.month = record.month;
        } else if (bill.status === 'paid') {
            return NextResponse.json(
                { error: 'Bill is already paid' },
                { status: 400 }
            );
        }

        if (!paymentAmount || paymentAmount <= 0) {
            console.error('Invalid payment amount:', paymentAmount);
            return NextResponse.json(
                { error: 'Invalid payment amount. Amount must be greater than 0.' },
                { status: 400 }
            );
        }

        const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
        const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!razorpayKeyId || !razorpayKeySecret) {
            return NextResponse.json(
                { error: 'Razorpay not configured' },
                { status: 500 }
            );
        }

        // Create Razorpay order
        const orderData = {
            amount: Math.round(paymentAmount * 100), // Amount in paise
            currency: 'INR',
            receipt: receiptLabel,
            notes: notes
        };

        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error('Razorpay Order API error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorBody
            });
            throw new Error(`Razorpay API error: ${JSON.stringify(errorBody)}`);
        }

        const order = await response.json();
        console.log('Razorpay Order created:', order.id);

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: razorpayKeyId,
            month: recordId ? bill.monthlyRecords?.find((r: any) => r.id === recordId)?.month : null,
            billDetails: {
                id: billId,
                description: bill.title || `Payment for ${bill.provider}`,
                accountNumber: bill.accountNumber,
                provider: bill.providerName || bill.provider
            }
        });

    } catch (error: any) {
        console.error('Error creating order:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create payment order' },
            { status: 500 }
        );
    }
}
