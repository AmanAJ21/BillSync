import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import AutoPaymentRecord from '../../../../../lib/models/AutoPaymentRecord';
import { clearDatabase } from '../../../../../lib/test/setup';

// Mock the middleware
vi.mock('../../../../../lib/middleware/role', () => ({
  requireAdmin: vi.fn().mockResolvedValue(null), // null means authorized
}));

// Mock mongoose connection
vi.mock('../../../../../lib/mongoose', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

describe('GET /api/admin/transactions', () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('should return paginated transactions with default parameters', async () => {
    // Create test transactions
    const testTransactions = [
      {
        userId: 'user1',
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn_001',
        billProvider: 'Provider A',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: 'user2',
        billId: 'bill2',
        amount: 200,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn_002',
        billProvider: 'Provider B',
        billType: 'water',
        status: 'failed',
        paymentCycleId: 'cycle2',
      },
    ];

    await AutoPaymentRecord.insertMany(testTransactions);

    // Create request
    const request = new NextRequest('http://localhost:3000/api/admin/transactions');

    // Execute
    const response = await GET(request);
    const data = await response.json();

    // Verify
    expect(response.status).toBe(200);
    expect(data.transactions).toHaveLength(2);
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.total).toBe(2);
    expect(data.transactions[0].transactionId).toBe('txn_001'); // Most recent first
  });

  it('should filter transactions by userId', async () => {
    // Create test transactions for different users
    await AutoPaymentRecord.insertMany([
      {
        userId: 'user1',
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn_001',
        billProvider: 'Provider A',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: 'user2',
        billId: 'bill2',
        amount: 200,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn_002',
        billProvider: 'Provider B',
        billType: 'water',
        status: 'success',
        paymentCycleId: 'cycle2',
      },
    ]);

    // Create request with userId filter
    const request = new NextRequest('http://localhost:3000/api/admin/transactions?userId=user1');

    // Execute
    const response = await GET(request);
    const data = await response.json();

    // Verify
    expect(response.status).toBe(200);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].userId).toBe('user1');
  });

  it('should filter transactions by status', async () => {
    // Create test transactions with different statuses
    await AutoPaymentRecord.insertMany([
      {
        userId: 'user1',
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn_001',
        billProvider: 'Provider A',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: 'user1',
        billId: 'bill2',
        amount: 200,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn_002',
        billProvider: 'Provider B',
        billType: 'water',
        status: 'failed',
        paymentCycleId: 'cycle2',
      },
    ]);

    // Create request with status filter
    const request = new NextRequest('http://localhost:3000/api/admin/transactions?status=failed');

    // Execute
    const response = await GET(request);
    const data = await response.json();

    // Verify
    expect(response.status).toBe(200);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].status).toBe('failed');
  });

  it('should filter transactions by date range', async () => {
    // Create test transactions with different dates
    await AutoPaymentRecord.insertMany([
      {
        userId: 'user1',
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn_001',
        billProvider: 'Provider A',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: 'user1',
        billId: 'bill2',
        amount: 200,
        paymentDate: new Date('2024-02-10'),
        transactionId: 'txn_002',
        billProvider: 'Provider B',
        billType: 'water',
        status: 'success',
        paymentCycleId: 'cycle2',
      },
    ]);

    // Create request with date range filter
    const request = new NextRequest(
      'http://localhost:3000/api/admin/transactions?startDate=2024-01-01&endDate=2024-01-31'
    );

    // Execute
    const response = await GET(request);
    const data = await response.json();

    // Verify
    expect(response.status).toBe(200);
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].transactionId).toBe('txn_001');
  });

  it('should handle pagination correctly', async () => {
    // Create multiple test transactions
    const transactions = [];
    for (let i = 1; i <= 15; i++) {
      transactions.push({
        userId: 'user1',
        billId: `bill${i}`,
        amount: 100 + i,
        paymentDate: new Date(`2024-01-${i.toString().padStart(2, '0')}`),
        transactionId: `txn_${i.toString().padStart(3, '0')}`,
        billProvider: `Provider ${i}`,
        billType: 'electricity',
        status: 'success',
        paymentCycleId: `cycle${i}`,
      });
    }
    await AutoPaymentRecord.insertMany(transactions);

    // Test first page
    const request1 = new NextRequest('http://localhost:3000/api/admin/transactions?page=1&limit=5');
    const response1 = await GET(request1);
    const data1 = await response1.json();

    expect(response1.status).toBe(200);
    expect(data1.transactions).toHaveLength(5);
    expect(data1.pagination.page).toBe(1);
    expect(data1.pagination.totalPages).toBe(3);
    expect(data1.pagination.hasNextPage).toBe(true);
    expect(data1.pagination.hasPrevPage).toBe(false);

    // Test second page
    const request2 = new NextRequest('http://localhost:3000/api/admin/transactions?page=2&limit=5');
    const response2 = await GET(request2);
    const data2 = await response2.json();

    expect(response2.status).toBe(200);
    expect(data2.transactions).toHaveLength(5);
    expect(data2.pagination.page).toBe(2);
    expect(data2.pagination.hasNextPage).toBe(true);
    expect(data2.pagination.hasPrevPage).toBe(true);
  });

  it('should return 400 for invalid pagination parameters', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/transactions?page=0&limit=101');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid pagination parameters');
  });

  it('should return 400 for invalid status parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/transactions?status=invalid');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid status');
  });

  it('should return 400 for invalid date format', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/transactions?startDate=invalid-date');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid startDate format');
  });

  it('should return empty results when no transactions match filters', async () => {
    // Create one transaction
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

    // Filter for non-existent user
    const request = new NextRequest('http://localhost:3000/api/admin/transactions?userId=nonexistent');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.transactions).toHaveLength(0);
    expect(data.pagination.total).toBe(0);
  });
});