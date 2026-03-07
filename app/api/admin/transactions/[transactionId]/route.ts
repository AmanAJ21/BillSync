import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/middleware/role';
import AutoPaymentRecord from '../../../../../lib/models/AutoPaymentRecord';
import Bill from '../../../../../lib/models/Bill';
import { getDatabase } from '../../../../../lib/mongodb';
import { ObjectId } from 'mongodb';
import { connectDB } from '../../../../../lib/mongoose';
import { fetchPaymentDetails } from '../../../../../lib/services/RazorpayService';

/**
 * GET /api/admin/transactions/[transactionId]
 * Get detailed transaction information including related bill and user data
 * Requires admin role
 * Validates: Requirements 14.2, 14.4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
    await connectDB();

    const { transactionId } = await params;

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Find the transaction record
    const transaction = await AutoPaymentRecord.findOne({
      transactionId: transactionId
    }).lean();

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Fetch related bill information
    let bill = null;
    try {
      // First try to get bill from Bill model (MongoDB bills collection)
      const db = await getDatabase();
      const bills = db.collection('bills');

      // Try to find by billId or _id
      let billQuery: any = {};
      if (ObjectId.isValid(transaction.billId)) {
        billQuery = { _id: new ObjectId(transaction.billId) };
      } else {
        billQuery = { billId: transaction.billId };
      }

      bill = await bills.findOne(billQuery);

      // If not found, try the Mongoose Bill model
      if (!bill) {
        bill = await Bill.findOne({ billId: transaction.billId }).lean();
      }
    } catch (error) {
      console.warn('Could not fetch bill details:', error);
      // Continue without bill details - transaction oversight should work even if bill is deleted
    }

    // Fetch user information (excluding sensitive data)
    let user = null;
    try {
      const db = await getDatabase();
      const users = db.collection('users');
      user = await users.findOne(
        { userId: transaction.userId },
        { projection: { password: 0, resetToken: 0, resetTokenExpiry: 0 } }
      );
    } catch (error) {
      console.warn('Could not fetch user details:', error);
      // Continue without user details
    }

    // For failed transactions, try to get additional error details from Razorpay
    let paymentDetails = null;
    if (transaction.status === 'failed') {
      try {
        // Only fetch from Razorpay if we have a valid transaction ID format
        if (transactionId.startsWith('pay_')) {
          paymentDetails = await fetchPaymentDetails(transactionId);
        }
      } catch (error) {
        console.warn('Could not fetch payment details from Razorpay:', error);
        // Continue without Razorpay details - this is optional information
      }
    }

    // Build response with all available information
    const response: any = {
      transaction: {
        ...transaction,
        // Add computed fields
        amountInRupees: transaction.amount, // AutoPaymentRecord stores in rupees
        paymentDateFormatted: transaction.paymentDate.toISOString(),
      }
    };

    if (bill) {
      // Merge bill data with transaction record data for complete information
      const b = bill as any;
      response.bill = {
        ...b,
        // Include data from transaction record if not in bill
        billType: b.billType || transaction.billType,
        provider: b.provider || transaction.billProvider,
        billNumber: b.billNumber || transaction.billNumber,
        customerName: b.customerName || transaction.customerName,
      };
    } else {
      // If bill not found, create a minimal bill object from transaction data
      response.bill = {
        billId: transaction.billId,
        provider: transaction.billProvider,
        billType: transaction.billType,
        amount: transaction.amount,
        billNumber: transaction.billNumber,
        customerName: transaction.customerName,
        status: 'paid', // Since payment was made
      };
    }

    if (user) {
      response.user = user;
    }

    // Include error details for failed transactions
    if (transaction.status === 'failed' && paymentDetails) {
      response.errorDetails = {
        errorCode: paymentDetails.error_code,
        errorDescription: paymentDetails.error_description,
        errorSource: paymentDetails.error_source,
        errorStep: paymentDetails.error_step,
        errorReason: paymentDetails.error_reason,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction details' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/transactions/[transactionId]
 * Prevent transaction modification - returns 409 Conflict
 * Validates: Requirements 14.5
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  // Check admin authorization first
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck;
  }

  // Always return conflict for any modification attempt
  return NextResponse.json(
    {
      error: 'Transaction modification not allowed',
      message: 'Payment transactions are immutable and cannot be modified to maintain transaction integrity'
    },
    { status: 409 }
  );
}

/**
 * DELETE /api/admin/transactions/[transactionId]
 * Prevent transaction deletion - returns 409 Conflict
 * Validates: Requirements 14.5
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  // Check admin authorization first
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck;
  }

  // Always return conflict for any deletion attempt
  return NextResponse.json(
    {
      error: 'Transaction deletion not allowed',
      message: 'Payment transactions are immutable and cannot be deleted to maintain transaction integrity'
    },
    { status: 409 }
  );
}

/**
 * PATCH /api/admin/transactions/[transactionId]
 * Prevent transaction modification - returns 409 Conflict
 * Validates: Requirements 14.5
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  // Check admin authorization first
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck;
  }

  // Always return conflict for any modification attempt
  return NextResponse.json(
    {
      error: 'Transaction modification not allowed',
      message: 'Payment transactions are immutable and cannot be modified to maintain transaction integrity'
    },
    { status: 409 }
  );
}