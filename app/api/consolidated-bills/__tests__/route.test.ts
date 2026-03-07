import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import ConsolidatedBill from '@/lib/models/ConsolidatedBill';
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

describe('GET /api/consolidated-bills', () => {
  const mockUserId = 'user123';

  beforeEach(async () => {
    // Clear all data before each test
    await ConsolidatedBill.deleteMany({});
    
    // Mock successful authentication
    vi.mocked(verifyToken).mockReturnValue({ userId: mockUserId });
  });

  it('should return all consolidated bills for authenticated user', async () => {
    // Create test consolidated bills (created in order, so cycle1 is older)
    const bill1 = await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle1',
      cycleStartDate: new Date('2024-01-01'),
      cycleEndDate: new Date('2024-01-31'),
      totalAmount: 250,
      autoPaymentRecords: ['record1', 'record2'],
      status: 'pending',
    });

    const bill2 = await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle2',
      cycleStartDate: new Date('2024-02-01'),
      cycleEndDate: new Date('2024-02-29'),
      totalAmount: 300,
      autoPaymentRecords: ['record3', 'record4'],
      status: 'paid',
      paidAt: new Date('2024-03-01'),
      razorpayOrderId: 'order123',
    });

    const request = new NextRequest('http://localhost:3000/api/consolidated-bills', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    // Log error if status is not 200
    if (response.status !== 200) {
      console.log('Error response:', data);
    }

    expect(response.status).toBe(200);
    expect(data.count).toBe(2);
    expect(data.consolidatedBills).toHaveLength(2);
    
    // Verify bills are sorted by most recent first (by createdAt)
    // bill2 was created second, so it should be first in the list
    expect(data.consolidatedBills[0].paymentCycleId).toBe('cycle2');
    expect(data.consolidatedBills[1].paymentCycleId).toBe('cycle1');
  });

  it('should include all required fields in response', async () => {
    await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle1',
      cycleStartDate: new Date('2024-01-01'),
      cycleEndDate: new Date('2024-01-31'),
      totalAmount: 250,
      autoPaymentRecords: ['record1', 'record2'],
      status: 'pending',
    });

    const request = new NextRequest('http://localhost:3000/api/consolidated-bills', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const bill = data.consolidatedBills[0];
    
    // Verify all required fields are present (Requirement 5.3)
    expect(bill).toHaveProperty('id');
    expect(bill).toHaveProperty('userId');
    expect(bill).toHaveProperty('paymentCycleId');
    expect(bill).toHaveProperty('cycleStartDate');
    expect(bill).toHaveProperty('cycleEndDate');
    expect(bill).toHaveProperty('totalAmount');
    expect(bill).toHaveProperty('status');
    expect(bill).toHaveProperty('itemCount');
    expect(bill.itemCount).toBe(2);
  });

  it('should only return bills for authenticated user', async () => {
    // Create bills for different users
    await ConsolidatedBill.create([
      {
        userId: mockUserId,
        paymentCycleId: 'cycle1',
        cycleStartDate: new Date('2024-01-01'),
        cycleEndDate: new Date('2024-01-31'),
        totalAmount: 250,
        autoPaymentRecords: ['record1'],
        status: 'pending',
      },
      {
        userId: 'otherUser',
        paymentCycleId: 'cycle2',
        cycleStartDate: new Date('2024-01-01'),
        cycleEndDate: new Date('2024-01-31'),
        totalAmount: 300,
        autoPaymentRecords: ['record2'],
        status: 'pending',
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/consolidated-bills', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(1);
    expect(data.consolidatedBills[0].userId).toBe(mockUserId);
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(verifyToken).mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/consolidated-bills', {
      headers: { Cookie: 'auth-token=invalid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid or expired token');
  });

  it('should return 401 when no auth token provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/consolidated-bills');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should return empty array when no bills exist', async () => {
    const request = new NextRequest('http://localhost:3000/api/consolidated-bills', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.count).toBe(0);
    expect(data.consolidatedBills).toEqual([]);
  });

  it('should display payment cycle period (Requirement 5.3)', async () => {
    const cycleStart = new Date('2024-01-01');
    const cycleEnd = new Date('2024-01-31');

    await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle1',
      cycleStartDate: cycleStart,
      cycleEndDate: cycleEnd,
      totalAmount: 250,
      autoPaymentRecords: ['record1'],
      status: 'pending',
    });

    const request = new NextRequest('http://localhost:3000/api/consolidated-bills', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const bill = data.consolidatedBills[0];
    expect(new Date(bill.cycleStartDate)).toEqual(cycleStart);
    expect(new Date(bill.cycleEndDate)).toEqual(cycleEnd);
  });

  it('should display total amount (Requirement 5.3)', async () => {
    await ConsolidatedBill.create({
      userId: mockUserId,
      paymentCycleId: 'cycle1',
      cycleStartDate: new Date('2024-01-01'),
      cycleEndDate: new Date('2024-01-31'),
      totalAmount: 450.75,
      autoPaymentRecords: ['record1', 'record2', 'record3'],
      status: 'pending',
    });

    const request = new NextRequest('http://localhost:3000/api/consolidated-bills', {
      headers: { Cookie: 'auth-token=valid-token' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.consolidatedBills[0].totalAmount).toBe(450.75);
  });
});
