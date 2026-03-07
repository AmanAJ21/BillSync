import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '../payment-history/route';
import { NextRequest } from 'next/server';
import { clearDatabase } from '@/lib/test/setup';
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

describe('GET /api/analytics/payment-history', () => {
  let testUserId: string;

  beforeEach(async () => {
    await clearDatabase();
    testUserId = 'test-user-123';
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('should return payment history for authenticated user', async () => {
    // Create cycles
    const cycle1 = await PaymentCycle.create({
      userId: testUserId,
      startDate: new Date('2023-12-01'),
      endDate: new Date('2023-12-31'),
      status: 'completed',
    });

    const cycle2 = await PaymentCycle.create({
      userId: testUserId,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'active',
    });

    // Add records
    await AutoPaymentRecord.create({
      userId: testUserId,
      billId: 'bill-1',
      amount: 100.00,
      paymentDate: new Date('2023-12-10'),
      transactionId: 'txn-dec',
      billProvider: 'Provider',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: cycle1._id.toString(),
    });

    await AutoPaymentRecord.create({
      userId: testUserId,
      billId: 'bill-2',
      amount: 200.00,
      paymentDate: new Date('2024-01-10'),
      transactionId: 'txn-jan',
      billProvider: 'Provider',
      billType: 'water',
      status: 'success',
      paymentCycleId: cycle2._id.toString(),
    });

    const request = new NextRequest('http://localhost:3000/api/analytics/payment-history', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.cycleCount).toBe(2);
    expect(data.data.history).toHaveLength(2);
  });

  it('should return 401 for unauthenticated request', async () => {
    const request = new NextRequest('http://localhost:3000/api/analytics/payment-history', {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should respect limit query parameter', async () => {
    // Create 5 cycles
    for (let i = 0; i < 5; i++) {
      await PaymentCycle.create({
        userId: testUserId,
        startDate: new Date(2024, i, 1),
        endDate: new Date(2024, i + 1, 0),
        status: i === 4 ? 'active' : 'completed',
      });
    }

    const request = new NextRequest('http://localhost:3000/api/analytics/payment-history?limit=3', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.history).toHaveLength(3);
  });

  it('should return 400 for invalid limit', async () => {
    const request = new NextRequest('http://localhost:3000/api/analytics/payment-history?limit=0', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Limit must be between 1 and 100');
  });

  it('should return 400 for limit exceeding maximum', async () => {
    const request = new NextRequest('http://localhost:3000/api/analytics/payment-history?limit=101', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Limit must be between 1 and 100');
  });

  it('should return empty history if user has no cycles', async () => {
    const request = new NextRequest('http://localhost:3000/api/analytics/payment-history', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.cycleCount).toBe(0);
    expect(data.data.history).toHaveLength(0);
  });

  it('should include payment details in history', async () => {
    const cycle = await PaymentCycle.create({
      userId: testUserId,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'active',
    });

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

    const request = new NextRequest('http://localhost:3000/api/analytics/payment-history', {
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.history[0].payments).toHaveLength(1);
    expect(data.data.history[0].payments[0].billProvider).toBe('Electric Company');
    expect(data.data.history[0].payments[0].amount).toBe(100.00);
  });
});
