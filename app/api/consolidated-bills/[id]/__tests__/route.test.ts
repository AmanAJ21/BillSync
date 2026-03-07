import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import ConsolidatedBill from '@/lib/models/ConsolidatedBill';
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

describe('GET /api/consolidated-bills/[id]', () => {
  const mockUserId = 'user123';

  beforeEach(async () => {
    // Clear all data before each test
    await ConsolidatedBill.deleteMany({});
    await AutoPaymentRecord.deleteMany({});
    
    // Mock successful authentication
    vi.mocked(verifyToken).mockReturnValue({ userId: mockUserId });
  });

  it('should return consolidated bill details with itemized bills', async () => {
    // Create auto payment records
    const record1 = await AutoPaymentRecord.create({
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

    const record2 = await AutoPaymentRecord.create({
      userId: mockUserId,
      billId: 'bill2',
      amount: 150,
      paymentDate: new Date('2024-01-20'),
      transactionId: 'txn2',
      billProvider: 'Water Co',
      billType: 'water',
      status: 'success',
      paymentCycleId: 'cycle1',
    });

    // Create consolidated bill
    const consolidatedBill = await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle1',
      cycleStartDate: new Date('2024-01-01'),
      cycleEndDate: new Date('2024-01-31'),
      totalAmount: 250,
      autoPaymentRecords: [record1._id.toString(), record2._id.toString()],
      status: 'pending',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/consolidated-bills/${consolidatedBill._id}`,
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: consolidatedBill._id.toString() }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(consolidatedBill._id.toString());
    expect(data.totalAmount).toBe(250);
    expect(data.itemizedBills).toHaveLength(2);
  });

  it('should display itemized bills with all required fields (Requirement 4.4, 5.3)', async () => {
    // Create auto payment record
    const record = await AutoPaymentRecord.create({
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

    // Create consolidated bill
    const consolidatedBill = await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle1',
      cycleStartDate: new Date('2024-01-01'),
      cycleEndDate: new Date('2024-01-31'),
      totalAmount: 100,
      autoPaymentRecords: [record._id.toString()],
      status: 'pending',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/consolidated-bills/${consolidatedBill._id}`,
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: consolidatedBill._id.toString() }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    const itemizedBill = data.itemizedBills[0];
    
    // Verify all required fields (provider name, bill type, amount, payment date)
    expect(itemizedBill).toHaveProperty('id');
    expect(itemizedBill).toHaveProperty('billId');
    expect(itemizedBill).toHaveProperty('billProvider');
    expect(itemizedBill.billProvider).toBe('Electric Co');
    expect(itemizedBill).toHaveProperty('billType');
    expect(itemizedBill.billType).toBe('electricity');
    expect(itemizedBill).toHaveProperty('amount');
    expect(itemizedBill.amount).toBe(100);
    expect(itemizedBill).toHaveProperty('paymentDate');
    expect(itemizedBill).toHaveProperty('transactionId');
    expect(itemizedBill).toHaveProperty('status');
  });

  it('should display total amount and cycle period (Requirement 5.3)', async () => {
    const record = await AutoPaymentRecord.create({
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

    const cycleStart = new Date('2024-01-01');
    const cycleEnd = new Date('2024-01-31');

    const consolidatedBill = await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle1',
      cycleStartDate: cycleStart,
      cycleEndDate: cycleEnd,
      totalAmount: 100,
      autoPaymentRecords: [record._id.toString()],
      status: 'pending',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/consolidated-bills/${consolidatedBill._id}`,
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: consolidatedBill._id.toString() }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalAmount).toBe(100);
    expect(new Date(data.cycleStartDate)).toEqual(cycleStart);
    expect(new Date(data.cycleEndDate)).toEqual(cycleEnd);
  });

  it('should return 404 when bill not found', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const request = new NextRequest(
      `http://localhost:3000/api/consolidated-bills/${fakeId}`,
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: fakeId }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Consolidated bill not found');
  });

  it('should return 403 when accessing another user\'s bill', async () => {
    const record = await AutoPaymentRecord.create({
      userId: 'otherUser',
      billId: 'bill1',
      amount: 100,
      paymentDate: new Date('2024-01-15'),
      transactionId: 'txn1',
      billProvider: 'Electric Co',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: 'cycle1',
    });

    const consolidatedBill = await ConsolidatedBill.create({
      userId: 'otherUser',
      paymentCycleId: 'cycle1',
      cycleStartDate: new Date('2024-01-01'),
      cycleEndDate: new Date('2024-01-31'),
      totalAmount: 100,
      autoPaymentRecords: [record._id.toString()],
      status: 'pending',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/consolidated-bills/${consolidatedBill._id}`,
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: consolidatedBill._id.toString() }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Unauthorized access to consolidated bill');
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(verifyToken).mockReturnValue(null);

    const request = new NextRequest(
      'http://localhost:3000/api/consolidated-bills/123',
      {
        headers: { Cookie: 'auth-token=invalid-token' },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: '123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid or expired token');
  });

  it('should return 401 when no auth token provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/consolidated-bills/123');

    const response = await GET(request, {
      params: Promise.resolve({ id: '123' }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should sort itemized bills by payment date (most recent first)', async () => {
    const record1 = await AutoPaymentRecord.create({
      userId: mockUserId,
      billId: 'bill1',
      amount: 100,
      paymentDate: new Date('2024-01-10'),
      transactionId: 'txn1',
      billProvider: 'Electric Co',
      billType: 'electricity',
      status: 'success',
      paymentCycleId: 'cycle1',
    });

    const record2 = await AutoPaymentRecord.create({
      userId: mockUserId,
      billId: 'bill2',
      amount: 150,
      paymentDate: new Date('2024-01-20'),
      transactionId: 'txn2',
      billProvider: 'Water Co',
      billType: 'water',
      status: 'success',
      paymentCycleId: 'cycle1',
    });

    const record3 = await AutoPaymentRecord.create({
      userId: mockUserId,
      billId: 'bill3',
      amount: 75,
      paymentDate: new Date('2024-01-15'),
      transactionId: 'txn3',
      billProvider: 'Gas Co',
      billType: 'gas',
      status: 'success',
      paymentCycleId: 'cycle1',
    });

    const consolidatedBill = await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle1',
      cycleStartDate: new Date('2024-01-01'),
      cycleEndDate: new Date('2024-01-31'),
      totalAmount: 325,
      autoPaymentRecords: [
        record1._id.toString(),
        record2._id.toString(),
        record3._id.toString(),
      ],
      status: 'pending',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/consolidated-bills/${consolidatedBill._id}`,
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: consolidatedBill._id.toString() }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.itemizedBills).toHaveLength(3);
    expect(data.itemizedBills[0].billId).toBe('bill2'); // Most recent (Jan 20)
    expect(data.itemizedBills[1].billId).toBe('bill3'); // Middle (Jan 15)
    expect(data.itemizedBills[2].billId).toBe('bill1'); // Oldest (Jan 10)
  });

  it('should include payment status information', async () => {
    const record = await AutoPaymentRecord.create({
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

    const consolidatedBill = await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle1',
      cycleStartDate: new Date('2024-01-01'),
      cycleEndDate: new Date('2024-01-31'),
      totalAmount: 100,
      autoPaymentRecords: [record._id.toString()],
      status: 'paid',
      paidAt: new Date('2024-02-01'),
      razorpayOrderId: 'order123',
    });

    const request = new NextRequest(
      `http://localhost:3000/api/consolidated-bills/${consolidatedBill._id}`,
      {
        headers: { Cookie: 'auth-token=valid-token' },
      }
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: consolidatedBill._id.toString() }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('paid');
    expect(data.paidAt).toBeDefined();
    expect(data.razorpayOrderId).toBe('order123');
  });
});
