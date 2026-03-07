import { NextRequest, NextResponse } from 'next/server';
import { validateInternalRequest, addInternalHeaders } from '@/lib/utils/internal-api';

// Provider lists for each bill type
const PROVIDERS = {
    electricity: ['Tata Power', 'BSES', 'Adani Electricity', 'MSEDCL', 'BESCOM', 'KSEB'],
    prepaid_mobile: ['Airtel', 'Jio', 'Vi', 'BSNL'],
    postpaid_mobile: ['Airtel', 'Jio', 'Vi', 'BSNL'],
    dth: ['Tata Sky', 'Airtel Digital TV', 'Dish TV', 'Sun Direct', 'D2H']
};

// Validation functions
function validateElectricityAccount(accountNumber: string): boolean {
    return /^\d{10,}$/.test(accountNumber);
}

function validateMobileNumber(accountNumber: string): boolean {
    return /^[6-9]\d{9}$/.test(accountNumber);
}

function validateDTHAccount(accountNumber: string): boolean {
    return /^\d{8,}$/.test(accountNumber);
}

export async function POST(request: NextRequest) {
    // Validate internal request
    const validationError = validateInternalRequest(request);
    if (validationError) return validationError;

    try {
        const body = await request.json();
        const { type, accountNumber, provider } = body;

        console.log('Verify request:', { type, accountNumber, provider });

        // Validate provider
        const validProviders = PROVIDERS[type as keyof typeof PROVIDERS];
        if (!validProviders || !validProviders.includes(provider)) {
            console.log('Invalid provider:', provider, 'Valid providers:', validProviders);
            return NextResponse.json(
                { error: `Invalid provider for ${type}. Valid providers: ${validProviders?.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate account number based on type
        let isValid = false;
        let errorMessage = '';

        switch (type) {
            case 'electricity':
                isValid = validateElectricityAccount(accountNumber);
                errorMessage = 'Account number must be at least 10 digits';
                break;
            case 'prepaid_mobile':
            case 'postpaid_mobile':
                isValid = validateMobileNumber(accountNumber);
                errorMessage = 'Mobile number must be 10 digits starting with 6-9';
                break;
            case 'dth':
                isValid = validateDTHAccount(accountNumber);
                errorMessage = 'Account number must be at least 8 digits';
                break;
            default:
                console.log('Invalid bill type:', type);
                return NextResponse.json(
                    { error: 'Invalid bill type' },
                    { status: 400 }
                );
        }

        if (!isValid) {
            console.log('Invalid account number:', accountNumber, 'Error:', errorMessage);
            return NextResponse.json(
                { error: errorMessage },
                { status: 400 }
            );
        }

        // Call external API to verify bill
        const billApi = process.env.BILL_API;
        const apiKey = process.env.API_KEY;

        if (!billApi || !apiKey) {
            return NextResponse.json(
                { error: 'Bill verification service not configured' },
                { status: 500 }
            );
        }

        try {
            const apiUrl = `${billApi}/api/data/verify`;
            console.log('Calling external API:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type,
                    accountNumber,
                    provider
                }),
            });

            console.log('External API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('External API error:', errorText);
                return NextResponse.json(
                    { error: 'Bill not found or invalid account details' },
                    { status: 404 }
                );
            }

            const data = await response.json();
            console.log('API response:', data);
            console.log('Bill ID from external API:', data.billDetails?.billId || data.billDetails?._id || data.billDetails?.id);

            // Check if bill exists
            if (!data.success || !data.billExists) {
                return NextResponse.json(
                    { error: data.message || 'No pending bill found for this account' },
                    { status: 404 }
                );
            }

            // Return the bill details in the expected format
            const billDetails = data.billDetails;
            const externalBillId = billDetails.billId || billDetails._id || billDetails.id;
            console.log('Bill verified successfully, external bill ID:', externalBillId);
            console.log('Full bill details:', billDetails);

            return NextResponse.json({
                success: true,
                externalBillId: externalBillId, // Store external bill ID
                customerName: billDetails.customerName || 'Customer',
                accountNumber: billDetails.accountNumber,
                provider: billDetails.providerName || provider,
                billNumber: billDetails.billNumber,
                billDate: billDetails.createdAt || new Date().toISOString(),
                dueDate: billDetails.dueDate,
                billingPeriod: billDetails.billingPeriod || 'Current Period',
                unitsConsumed: billDetails.unitsConsumed,
                dataUsed: billDetails.dataUsed,
                channels: billDetails.channels,
                breakdown: billDetails.breakdown
            });
        } catch (error) {
            console.error('External API error:', error);
            return NextResponse.json(
                { error: 'Failed to connect to bill verification service' },
                { status: 503 }
            );
        }

    } catch (error) {
        console.error('Error verifying bill:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to verify bill' },
            { status: 500 }
        );
    }
}

// Remove the mock bill generation function
// function generateMockBillDetails(...) { ... }
