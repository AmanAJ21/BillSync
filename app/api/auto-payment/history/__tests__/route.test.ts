import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';
import { verifyToken } from '@/lib/auth';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  verifyToken: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GET /api/auto-payment/history', () => {
  const mockUserId = 'user123';

  beforeEach(async () => {
    // Mock successful authentication
    vi.mocked(verifyToken).mockReturnValue({ userId: mockUserId });
  });

  it('should return auto-payment history with default pagination', async () => {
    // Create test records
    await AutoPaymentRecord.create([
      {
        userId: mockUserId,
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn1',
        billProvider: 'Electric Co',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: mockUserId,
        billId: 'bill2',
        amount: 50,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn2',
        billProvider: 'Water Co',
        billType: 'water',
        status: 'settled',
        paymentCycleId: 'cycle1',
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/auto-payment/history', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.records).toHaveLength(2);
    expect(data.records[0].isAutoPaid).toBe(true);
    expect(data.records[0].amount).toBe(100);
    expect(data.pagination).toEqual({
      page: 1,
      limit: 10,
      totalCount: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('should filter records by date range', async () => {
    // Create test records with different dates
    await AutoPaymentRecord.create([
      {
        userId: mockUserId,
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn1',
        billProvider: 'Electric Co',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: mockUserId,
        billId: 'bill2',
        amount: 50,
        paymentDate: new Date('2024-02-10'),
        transactionId: 'txn2',
        billProvider: 'Water Co',
        billType: 'water',
        status: 'success',
        paymentCycleId: 'cycle2',
      },
      {
        userId: mockUserId,
        billId: 'bill3',
        amount: 75,
        paymentDate: new Date('2024-03-05'),
        transactionId: 'txn3',
        billProvider: 'Gas Co',
        billType: 'gas',
        status: 'success',
        paymentCycleId: 'cycle3',
      },
    ]);

    const request = new NextRequest(
      'http://localhost:3000/api/auto-payment/history?startDate=2024-02-01&endDate=2024-02-28',
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.records).toHaveLength(1);
    expect(data.records[0].billId).toBe('bill2');
    expect(data.pagination.totalCount).toBe(1);
  });

  it('should support pagination with custom page and limit', async () => {
    // Create 15 test records
    const records = Array.from({ length: 15 }, (_, i) => ({
      userId: mockUserId,
      billId: `bill${i + 1}`,
      amount: 100 + i,
      paymentDate: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      transactionId: `txn${i + 1}`,
      billProvider: 'Provider',
      billType: 'electricity',
      status: 'success' as const,
      paymentCycleId: 'cycle1',
    }));
    await AutoPaymentRecord.create(records);

    // Request page 2 with limit 5
    const request = new NextRequest(
      'http://localhost:3000/api/auto-payment/history?page=2&limit=5',
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.records).toHaveLength(5);
    expect(data.pagination).toEqual({
      page: 2,
      limit: 5,
      totalCount: 15,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('should return records sorted by payment date (most recent first)', async () => {
    await AutoPaymentRecord.create([
      {
        userId: mockUserId,
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn1',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: mockUserId,
        billId: 'bill2',
        amount: 50,
        paymentDate: new Date('2024-01-20'),
        transactionId: 'txn2',
        billProvider: 'Provider',
        billType: 'water',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: mockUserId,
        billId: 'bill3',
        amount: 75,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn3',
        billProvider: 'Provider',
        billType: 'gas',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/auto-payment/history', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.records[0].billId).toBe('bill2'); // Most recent (Jan 20)
    expect(data.records[1].billId).toBe('bill3'); // Middle (Jan 15)
    expect(data.records[2].billId).toBe('bill1'); // Oldest (Jan 10)
  });

  it('should only return records for authenticated user', async () => {
    // Create records for different users
    await AutoPaymentRecord.create([
      {
        userId: mockUserId,
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn1',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: 'otherUser',
        billId: 'bill2',
        amount: 50,
        paymentDate: new Date('2024-01-15'),
        transactionId: 'txn2',
        billProvider: 'Provider',
        billType: 'water',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/auto-payment/history', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.records).toHaveLength(1);
    expect(data.records[0].userId).toBe(mockUserId);
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(verifyToken).mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/auto-payment/history', {
      headers: { Cookie: 'auth-token=invalid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid or expired token');
  });

  it('should return 401 when no auth token provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/auto-payment/history');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 400 for invalid pagination parameters', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auto-payment/history?page=0&limit=200',
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid pagination parameters');
  });

  it('should return 400 for invalid date format', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/auto-payment/history?startDate=invalid-date',
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid startDate format');
  });

  it('should include all required fields in response', async () => {
    await AutoPaymentRecord.create({
      userId: mockUserId,
      billId: 'bill1',
      amount: 100,
      paymentDate: new Date('2024-01-15'),
      transactionId: 'txn1',
      billProvider: 'Electric Co',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: 'cycle1',
    });

    const request = new NextRequest('http://localhost:3000/api/auto-payment/history', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const record = data.records[0];
    
    // Verify all required fields are present
    expect(record).toHaveProperty('id');
    expect(record).toHaveProperty('userId');
    expect(record).toHaveProperty('billId');
    expect(record).toHaveProperty('amount');
    expect(record).toHaveProperty('paymentDate');
    expect(record).toHaveProperty('transactionId');
    expect(record).toHaveProperty('billProvider');
    expect(record).toHaveProperty('billType');
    expect(record).toHaveProperty('status');
    expect(record).toHaveProperty('paymentCycleId');
    expect(record).toHaveProperty('isAutoPaid');
    expect(record).toHaveProperty('createdAt');
    expect(record).toHaveProperty('updatedAt');
  });

  it('should return empty array when no records exist', async () => {
    const request = new NextRequest('http://localhost:3000/api/auto-payment/history', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.records).toEqual([]);
    expect(data.pagination.totalCount).toBe(0);
  });

  it('should filter by startDate only', async () => {
    await AutoPaymentRecord.create([
      {
        userId: mockUserId,
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn1',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: mockUserId,
        billId: 'bill2',
        amount: 50,
        paymentDate: new Date('2024-02-15'),
        transactionId: 'txn2',
        billProvider: 'Provider',
        billType: 'water',
        status: 'success',
        paymentCycleId: 'cycle2',
      },
    ]);

    const request = new NextRequest(
      'http://localhost:3000/api/auto-payment/history?startDate=2024-02-01',
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.records).toHaveLength(1);
    expect(data.records[0].billId).toBe('bill2');
  });

  it('should filter by endDate only', async () => {
    await AutoPaymentRecord.create([
      {
        userId: mockUserId,
        billId: 'bill1',
        amount: 100,
        paymentDate: new Date('2024-01-10'),
        transactionId: 'txn1',
        billProvider: 'Provider',
        billType: 'electricity',
        status: 'success',
        paymentCycleId: 'cycle1',
      },
      {
        userId: mockUserId,
        billId: 'bill2',
        amount: 50,
        paymentDate: new Date('2024-02-15'),
        transactionId: 'txn2',
        billProvider: 'Provider',
        billType: 'water',
        status: 'success',
        paymentCycleId: 'cycle2',
      },
    ]);

    const request = new NextRequest(
      'http://localhost:3000/api/auto-payment/history?endDate=2024-01-31',
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.records).toHaveLength(1);
    expect(data.records[0].billId).toBe('bill1');
  });
});
