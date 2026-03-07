import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE, PATCH } from '../route';
import AutoPaymentRecord from '../../../../../../lib/models/AutoPaymentRecord';
import Bill from '../../../../../../lib/models/Bill';
import { clearDatabase } from '../../../../../../lib/test/setup';

// Mock the middleware
vi.mock('../../../../../../lib/middleware/role', () => ({
  requireAdmin: vi.fn().mockResolvedValue(null), // null means authorized
}));

// Mock mongoose connection
vi.mock('../../../../../../lib/mongoose', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

// Mock MongoDB connection for user data
vi.mock('../../../../../../lib/mongodb', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    collection: vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue({
        _id: 'user123',
        userId: 'user1',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date('2024-01-01'),
      }),
    }),
  }),
}));

// Mock RazorpayService
vi.mock('../../../../../../lib/services/RazorpayService', () => ({
  fetchPaymentDetails: vi.fn().mockResolvedValue({
    error_code: 'BAD_REQUEST_ERROR',
    error_description: 'Payment failed due to insufficient funds',
    error_source: 'customer',
    error_step: 'payment_authentication',
    error_reason: 'payment_failed',
  }),
}));

describe('GET /api/admin/transactions/[transactionId]', () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('should return transaction details with related data', async () => {
    // Create test transaction
    const transaction = await AutoPaymentRecord.create({
      userId: 'user1',
      billId: 'bill1',
      amount: 100,
      paymentDate: new Date('2024-01-15'),
      transactionId: 'txn_001',
      billProvider: 'Provider A',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: 'cycle1',
    });

    // Create related bill
    await Bill.create({
      billId: 'bill1',
      userId: 'user1',
      provider: 'Provider A',
      amount: 100,
      dueDate: new Date('2024-01-20'),
      status: 'paid',
      billType: 'electricity',
      accountNumber: '1234567890',
      description: 'Monthly electricity bill',
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/admin/transactions/txn_001');

    // Execute
    const response = await GET(request, { params: { transactionId: 'txn_001' } });
    const data = await response.json();

    // Verify
    expect(response.status).toBe(200);
    expect(data.transaction).toBeDefined();
    expect(data.transaction.transactionId).toBe('txn_001');
    expect(data.transaction.amountInRupees).toBe(100);
    expect(data.bill).toBeDefined();
    expect(data.bill.billId).toBe('bill1');
    expect(data.user).toBeDefined();
    expect(data.user.userId).toBe('user1');
  });

  it('should return transaction details even without related bill', async () => {
    // Create test transaction without related bill
    await AutoPaymentRecord.create({
      userId: 'user1',
      billId: 'bill1',
      amount: 100,
      paymentDate: new Date('2024-01-15'),
      transactionId: 'txn_001',
      billProvider: 'Provider A',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: 'cycle1',
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/admin/transactions/txn_001');

    // Execute
    const response = await GET(request, { params: { transactionId: 'txn_001' } });
    const data = await response.json();

    // Verify
    expect(response.status).toBe(200);
    expect(data.transaction).toBeDefined();
    expect(data.transaction.transactionId).toBe('txn_001');
    expect(data.bill).toBeUndefined(); // No bill found
    expect(data.user).toBeDefined(); // User should still be found
  });

  it('should include error details for failed transactions', async () => {
    // Create failed transaction
    await AutoPaymentRecord.create({
      userId: 'user1',
      billId: 'bill1',
      amount: 100,
      paymentDate: new Date('2024-01-15'),
      transactionId: 'pay_failed_001', // Razorpay format
      billProvider: 'Provider A',
      billType: 'electricity',
      status: 'failed',
      paymentCycleId: 'cycle1',
    });

    // Create request
    const request = new NextRequest('http://localhost:3000/api/admin/transactions/pay_failed_001');

    // Execute
    const response = await GET(request, { params: { transactionId: 'pay_failed_001' } });
    const data = await response.json();

    // Verify
    expect(response.status).toBe(200);
    expect(data.transaction.status).toBe('failed');
    expect(data.errorDetails).toBeDefined();
    expect(data.errorDetails.errorCode).toBe('BAD_REQUEST_ERROR');
    expect(data.errorDetails.errorDescription).toContain('insufficient funds');
  });

  it('should return 404 for non-existent transaction', async () => {
    // Create request for non-existent transaction
    const request = new NextRequest('http://localhost:3000/api/admin/transactions/nonexistent');

    // Execute
    const response = await GET(request, { params: { transactionId: 'nonexistent' } });
    const data = await response.json();

    // Verify
    expect(response.status).toBe(404);
    expect(data.error).toBe('Transaction not found');
  });

  it('should return 400 for missing transaction ID', async () => {
    // Create request without transaction ID
    const request = new NextRequest('http://localhost:3000/api/admin/transactions/');

    // Execute
    const response = await GET(request, { params: { transactionId: '' } });
    const data = await response.json();

    // Verify
    expect(response.status).toBe(400);
    expect(data.error).toBe('Transaction ID is required');
  });
});

describe('PUT /api/admin/transactions/[transactionId]', () => {
  it('should prevent transaction modification', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/transactions/txn_001', {
      method: 'PUT',
      body: JSON.stringify({ amount: 200 }),
    });

    const response = await PUT(request, { params: { transactionId: 'txn_001' } });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Transaction modification not allowed');
    expect(data.message).toContain('immutable');
  });
});

describe('DELETE /api/admin/transactions/[transactionId]', () => {
  it('should prevent transaction deletion', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/transactions/txn_001', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: { transactionId: 'txn_001' } });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Transaction deletion not allowed');
    expect(data.message).toContain('immutable');
  });
});

describe('PATCH /api/admin/transactions/[transactionId]', () => {
  it('should prevent transaction modification', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/transactions/txn_001', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'settled' }),
    });

    const response = await PATCH(request, { params: { transactionId: 'txn_001' } });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Transaction modification not allowed');
    expect(data.message).toContain('immutable');
  });
});