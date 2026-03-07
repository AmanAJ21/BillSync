import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';
import { verifyAuth } from '@/lib/middleware/auth';
import { manualPaymentService } from '@/lib/services/ManualPaymentService';

export async function POST(request: NextRequest) {
    // Validate internal request
    const validationError = validateInternalRequest(request);
    if (validationError) return validationError;

    // Also get authenticated user for payment record
    const authResult = await verifyAuth(request);
    const authenticatedUserId = authResult.authenticated ? authResult.user?.id : null;

    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, billId, recordId } = await request.json();

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !billId) {
            return NextResponse.json(
                { error: 'Missing payment details' },
                { status: 400 }
            );
        }

        const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!razorpayKeySecret) {
            return NextResponse.json(
                { error: 'Razorpay not configured' },
                { status: 500 }
            );
        }

        // Verify Razorpay signature
        const generatedSignature = crypto
            .createHmac('sha256', razorpayKeySecret)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return NextResponse.json(
                { error: 'Invalid payment signature' },
                { status: 400 }
            );
        }

        // Get bill details
        const db = await getDatabase();
        const bills = db.collection('bills');

        let query: any = {};
        if (ObjectId.isValid(billId)) {
            query = { _id: new ObjectId(billId) };
        } else {
            query = { billId: billId };
        }

        const bill = await bills.findOne(query);

        if (!bill) {
            console.error('Bill not found for verification:', billId);
            return NextResponse.json(
                { error: 'Bill not found' },
                { status: 404 }
            );
        }

        // Get the amount from the record or bill
        let paymentAmount = bill.amount || 0;
        let recordMonth = '';
        
        if (recordId && bill.monthlyRecords) {
            const record = bill.monthlyRecords.find((r: any) => r.id === recordId);
            if (record) {
                paymentAmount = record.amount;
                recordMonth = record.month;
            }
        }

        // Update local database
        const updateData: any = {
            $set: {
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                paidAt: new Date(),
                updatedAt: new Date()
            }
        };

        if (recordId) {
            updateData.$set['monthlyRecords.$[elem].status'] = 'paid';
            updateData.$set['monthlyRecords.$[elem].paymentId'] = razorpay_payment_id;
            updateData.$set['monthlyRecords.$[elem].paidAt'] = new Date();

            await bills.updateOne(
                query,
                updateData,
                { arrayFilters: [{ 'elem.id': recordId }] }
            );
        } else {
            updateData.$set.status = 'paid';
            await bills.updateOne(
                query,
                updateData
            );
        }

        // Save manual payment record to ManualPayment collection
        try {
            // Use authenticated user ID, fallback to bill's userId, then 'unknown'
            const paymentUserId = authenticatedUserId || bill.userId || 'unknown';
            
            console.log('Saving manual payment record with userId:', paymentUserId, 'authenticatedUserId:', authenticatedUserId, 'bill.userId:', bill.userId);
            
            await manualPaymentService.createPayment({
                userId: paymentUserId,
                billId: bill._id.toString(),
                amount: paymentAmount,
                transactionId: razorpay_payment_id,
                razorpayOrderId: razorpay_order_id,
                razorpayPaymentId: razorpay_payment_id,
                billProvider: bill.provider || 'Unknown Provider',
                billType: bill.billType || 'other',
                recordId: recordId || undefined,
                recordMonth: recordMonth || undefined,
                billNumber: bill.billNumber || undefined,
                customerName: bill.customerName || undefined,
            });
            
            console.log('Manual payment record saved successfully:', razorpay_payment_id, 'for userId:', paymentUserId);
        } catch (recordError) {
            console.error('Failed to save manual payment record:', recordError);
            // Don't fail the entire transaction if record saving fails
        }

        // Update external API status
        const billApi = process.env.BILL_API;
        const apiKey = process.env.API_KEY;

        if (billApi && apiKey) {
            try {
                let externalBillId = bill.externalBillId;

                // If externalBillId is not stored, try to fetch it from external API
                if (!externalBillId) {
                    console.log('External bill ID not found, querying external API...');
                    try {
                        const queryParams = new URLSearchParams({
                            accountNumber: bill.accountNumber,
                            provider: bill.providerName,
                            type: bill.type
                        });

                        const queryResponse = await fetch(`${billApi}/api/external/bills/query?${queryParams}`, {
                            method: 'GET',
                            headers: {
                                'x-api-key': apiKey,
                                'Content-Type': 'application/json',
                            }
                        });

                        if (queryResponse.ok) {
                            const queryData = await queryResponse.json();
                            if (queryData.bills && queryData.bills.length > 0) {
                                externalBillId = queryData.bills[0].billId || queryData.bills[0]._id || queryData.bills[0].id;
                                console.log('Found external bill ID from query:', externalBillId);

                                // Update local database with the external bill ID
                                await bills.updateOne(
                                    query,
                                    { $set: { externalBillId: externalBillId } }
                                );
                            }
                        }
                    } catch (queryError) {
                        console.error('Failed to query external bill ID:', queryError);
                    }
                }

                // Prepare update payload
                const updatePayload: any = {
                    status: 'paid',
                    transactionId: razorpay_payment_id
                };

                // Use external bill ID if available
                if (externalBillId) {
                    updatePayload.billId = externalBillId; // External API expects 'billId', not 'externalBillId'
                    console.log('Updating external API with billId:', externalBillId);
                } else {
                    updatePayload.accountNumber = bill.accountNumber;
                    updatePayload.provider = bill.providerName;
                    updatePayload.type = bill.type;
                    console.log('Updating external API with account details:', { accountNumber: bill.accountNumber, provider: bill.providerName, type: bill.type });
                }

                console.log('Sending update payload to external API:', updatePayload);

                const updateResponse = await fetch(`${billApi}/api/external/bills/update-status`, {
                    method: 'POST',
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updatePayload)
                });

                if (!updateResponse.ok) {
                    const errorData = await updateResponse.json().catch(() => ({}));
                    console.error('Failed to update external API status:', errorData);
                } else {
                    const successData = await updateResponse.json();
                    console.log('External API status updated successfully:', successData);
                }
            } catch (error) {
                console.error('Failed to update external API:', error);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Payment verified successfully',
            paymentId: razorpay_payment_id
        });

    } catch (error) {
        console.error('Error verifying payment:', error);
        return NextResponse.json(
            { error: 'Failed to verify payment' },
            { status: 500 }
        );
    }
}
