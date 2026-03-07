import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import ConsolidatedBill from '@/lib/models/ConsolidatedBill';
import AutoPaymentRecord from '@/lib/models/AutoPaymentRecord';
import PaymentCycle from '@/lib/models/PaymentCycle';
import { clearDatabase } from '@/lib/test/setup';
import jwt from 'jsonwebtoken';

// Mock the auth helper
vi.mock('@/lib/utils/auth-helper', () => ({
  authenticateRequest: (request: NextRequest) => {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return {
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      };
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret') as { userId: string; role: 'regular' | 'admin' };
      return { userId: decoded.userId };
    } catch {
      return {
        error: new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 }),
      };
    }
  },
}));

describe('GET /api/consolidated-bills/[id]/pdf', () => {
  let token: string;
  const userId = 'user123';

  beforeEach(async () => {
    await clearDatabase();
    // Generate a test token
    token = jwt.sign({ userId, role: 'regular' }, process.env.JWT_SECRET || 'test-secret');
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('should download PDF for a valid consolidated bill', async () => {
    // Create a payment cycle
    const paymentCycle = await PaymentCycle.create({
      userId,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'active',
    });

    // Create auto payment records
    const record1 = await AutoPaymentRecord.create({
      userId,
      billId: 'bill1',
      amount: 100,
      paymentDate: new Date('2024-01-15'),
      transactionId: 'txn1',
      billProvider: 'Provider A',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: paymentCycle._id.toString(),
    });

    const record2 = await AutoPaymentRecord.create({
      userId,
      billId: 'bill2',
      amount: 200,
      paymentDate: new Date('2024-01-20'),
      transactionId: 'txn2',
      billProvider: 'Provider B',
      billType: 'water',
      status: 'success',
      paymentCycleId: paymentCycle._id.toString(),
    });

    // Create consolidated bill
    const consolidatedBill = await ConsolidatedBill.create({
      userId,
      paymentCycleId: paymentCycle._id.toString(),
      cycleStartDate: paymentCycle.startDate,
      cycleEndDate: paymentCycle.endDate,
      totalAmount: 300,
      autoPaymentRecords: [record1._id.toString(), record2._id.toString()],
      status: 'pending',
    });

    // Create request
    const request = new NextRequest(
      `http://localhost:3000/api/consolidated-bills/${consolidatedBill._id}/pdf`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );

    // Call endpoint
    const response = await GET(request, {
      params: Promise.resolve({ id: consolidatedBill._id.toString() }),
    });

    // Assertions - Requirement 5.4: Download as PDF
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-disposition')).toContain('.pdf');

    // Verify PDF content
    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });

  it('should return 401 when not authenticated', async () => {
    // Create request without token
    const request = new NextRequest(
      'http://localhost:3000/api/consolidated-bills/123/pdf'
    );

    // Call endpoint
    const response = await GET(request, {
      params: Promise.resolve({ id: '123' }),
    });

    // Assertions
    expect(response.status).toBe(401);
  });

  it('should return 404 when consolidated bill not found', async () => {
    // Create request
    const request = new NextRequest(
      'http://localhost:3000/api/consolidated-bills/507f1f77bcf86cd799439011/pdf',
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );

    // Call endpoint
    const response = await GET(request, {
      params: Promise.resolve({ id: '507f1f77bcf86cd799439011' }),
    });

    // Assertions
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Consolidated bill not found');
  });

  it('should return 403 when accessing another user\'s bill', async () => {
    // Create a payment cycle for a different user
    const paymentCycle = await PaymentCycle.create({
      userId: 'user456',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      status: 'active',
    });

    // Create auto payment record
    const record = await AutoPaymentRecord.create({
      userId: 'user456',
      billId: 'bill1',
      amount: 100,
      paymentDate: new Date('2024-01-15'),
      transactionId: 'txn1',
      billProvider: 'Provider A',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: paymentCycle._id.toString(),
    });

    // Create consolidated bill for different user
    const consolidatedBill = await ConsolidatedBill.create({
      userId: 'user456',
      paymentCycleId: paymentCycle._id.toString(),
      cycleStartDate: paymentCycle.startDate,
      cycleEndDate: paymentCycle.endDate,
      totalAmount: 100,
      autoPaymentRecords: [record._id.toString()],
      status: 'pending',
    });

    // Create request with user123's token
    const request = new NextRequest(
      `http://localhost:3000/api/consolidated-bills/${consolidatedBill._id}/pdf`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );

    // Call endpoint
    const response = await GET(request, {
      params: Promise.resolve({ id: consolidatedBill._id.toString() }),
    });

    // Assertions
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized access to consolidated bill');
  });
});
