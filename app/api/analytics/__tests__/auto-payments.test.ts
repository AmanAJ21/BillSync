import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '../auto-payments/route';
import { NextRequest } from 'next/server';
import { clearDatabase } from '@/lib/test/setup';
import AutoPaymentConfig from '@/lib/models/AutoPaymentConfig';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';
import PaymentCycle from '@/lib/models/PaymentCycle';

// Mock the auth helper
vi.mock('@/lib/utils/auth-helper', () => ({
  authenticateRequest: vi.fn((request: NextRequest) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== 'Bearer valid-token') {
      return {
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
        }),
      };
    }
    return {
      userId: 'test-user-123',
      error: null,
    };
  }),
}));

describe('GET /api/analytics/auto-payments', () => {
  let testUserId: string;

  beforeEach(async () => {
    await clearDatabase();
    testUserId = 'test-user-123';
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('should return analytics for authenticated user', async () => {
    // Create active payment cycle
    const cycle = await PaymentCycle.create({
      userId: testUserId,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'active',
    });

    // Create payment records
    await AutoPaymentRecord.create({
      userId: testUserId,
      billId: 'bill-1',
      amount: 100.00,
      paymentDate: new Date('2024-01-10'),
      transactionId: 'txn-1',
      billProvider: 'Electric Company',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: cycle._id.toString(),
    });

    // Create enabled configs
    await AutoPaymentConfig.create({
      userId: testUserId,
      billId: 'bill-1',
      enabled: true,
    });

    const request = new NextRequest('http://localhost:3000/api/analytics/auto-payments', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.currentCycle).toBeDefined();
    expect(data.data.currentCycle.totalAmount).toBe(100.00);
    expect(data.data.enabledConfigs).toBe(1);
    expect(data.data.billTypeBreakdown).toHaveLength(1);
  });

  it('should return 401 for unauthenticated request', async () => {
    const request = new NextRequest('http://localhost:3000/api/analytics/auto-payments', {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return 500 if no active payment cycle exists', async () => {
    const request = new NextRequest('http://localhost:3000/api/analytics/auto-payments', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it('should return analytics with empty current cycle', async () => {
    // Create active payment cycle with no records
    await PaymentCycle.create({
      userId: testUserId,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'active',
    });

    const request = new NextRequest('http://localhost:3000/api/analytics/auto-payments', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.currentCycle.totalAmount).toBe(0);
    expect(data.data.currentCycle.paymentCount).toBe(0);
  });

  it('should return analytics with bill type breakdown', async () => {
    // Create active payment cycle
    const cycle = await PaymentCycle.create({
      userId: testUserId,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'active',
    });

    // Create payment records with different bill types
    await AutoPaymentRecord.create({
      userId: testUserId,
      billId: 'bill-1',
      amount: 100.00,
      paymentDate: new Date('2024-01-10'),
      transactionId: 'txn-1',
      billProvider: 'Electric Company',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: cycle._id.toString(),
    });

    await AutoPaymentRecord.create({
      userId: testUserId,
      billId: 'bill-2',
      amount: 75.00,
      paymentDate: new Date('2024-01-15'),
      transactionId: 'txn-2',
      billProvider: 'Water Company',
      billType: 'water',
      status: 'success',
      paymentCycleId: cycle._id.toString(),
    });

    const request = new NextRequest('http://localhost:3000/api/analytics/auto-payments', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.billTypeBreakdown).toHaveLength(2);
    expect(data.data.currentCycle.totalAmount).toBe(175.00);
  });
});
