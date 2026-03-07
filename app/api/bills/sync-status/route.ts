import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

export async function POST(request: NextRequest) {
  // Validate internal request
  const validationError = validateInternalRequest(request);
  if (validationError) return validationError;

  try {
        const billApi = process.env.BILL_API;
        const apiKey = process.env.API_KEY;

        if (!billApi || !apiKey) {
            return NextResponse.json(
                { error: 'API configuration missing' },
                { status: 500 }
            );
        }

        // Get all bills from local database
        const db = await getDatabase();
        const bills = db.collection('bills');
        const allBills = await bills.find({}).toArray();

        let updatedCount = 0;
        const results = [];

        // Check status for each bill
        for (const bill of allBills) {
            try {
                // Query external API for bill status
                const queryParams = new URLSearchParams({
                    accountNumber: bill.accountNumber,
                    provider: bill.providerName,
                    type: bill.type
                });

                const response = await fetch(`${billApi}/api/external/bills/query?${queryParams}`, {
                    method: 'GET',
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Check if there's a matching bill in the response
                    if (data.bills && data.bills.length > 0) {
                        const externalBill = data.bills[0];
                        
                        // Update local bill if status changed
                        if (externalBill.status !== bill.status) {
                            await bills.updateOne(
                                { _id: bill._id },
                                {
                                    $set: {
                                        status: externalBill.status,
                                        updatedAt: new Date(),
                                        lastSyncedAt: new Date()
                                    }
                                }
                            );
                            updatedCount++;
                            results.push({
                                billId: bill._id.toString(),
                                accountNumber: bill.accountNumber,
                                oldStatus: bill.status,
                                newStatus: externalBill.status
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error checking status for bill ${bill._id}:`, error);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Synced ${updatedCount} bill(s)`,
            totalBills: allBills.length,
            updatedCount,
            updates: results
        });

    } catch (error) {
        console.error('Error syncing bill statuses:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sync bill statuses' },
            { status: 500 }
        );
    }
}
